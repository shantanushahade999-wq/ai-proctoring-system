import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export default function ProctoringEngine({ onEvent, onCritical }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Keep track of state to prevent spamming logs
  const stateRef = useRef({
    lastFaceCount: 1,
    lookingAwayFrames: 0,
    noFaceFrames: 0,
    lastWarningTime: 0
  });

  useEffect(() => {
    let faceLandmarker;
    let requestAnimationFrameId;
    let stream;

    const initializeMediaPipe = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 2 // Detect up to 2 faces to catch multiple people
        });
        setIsModelLoaded(true);
        startWebcam();
      } catch (err) {
        console.error("Error loading MediaPipe:", err);
        setError("Failed to load AI model");
        onEvent('danger', 'System Error: Failed to load proctoring engine.');
      }
    };

    let audioContext;
    let analyser;
    let microphone;

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 },
          audio: true // Request audio permission as well
        });

        // Setup Web Audio API for volume analysis
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
      } catch (err) {
        console.error("Webcam error:", err);
        setError("Camera/Microphone access denied");
        onEvent('danger', 'Access denied. Please allow camera and microphone access.');
      }
    };

    let recognition;
    const setupAudioDetection = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event) => {
          const now = Date.now();
          const state = stateRef.current;
          
          if (now - state.lastWarningTime > 3000) {
            // Check volume to determine if it's the user or background noise
            let isBackground = false;
            let averageVolume = 0;
            
            if (analyser) {
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              averageVolume = sum / dataArray.length;
              
              // If volume is low but speech is detected, it's likely someone else in the background
              if (averageVolume < 25) { 
                 isBackground = true;
              }
            }

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal || event.results[i][0].confidence > 0.3) {
                if (isBackground) {
                  onCritical('Background voice detected! Ensure you are alone in a quiet room.');
                  state.lastWarningTime = now;
                } else {
                  // User is speaking loudly enough, assume they are reading questions
                  onEvent('info', 'User speaking (Allowed).');
                  state.lastWarningTime = now;
                }
                break;
              }
            }
          }
        };

        recognition.onerror = (event) => {
          console.warn("Speech recognition error:", event.error);
        };

        try {
          recognition.start();
        } catch(e) {
          console.error(e);
        }
      } else {
        console.warn("Speech Recognition API not supported in this browser.");
      }
    };

    const analyzeFace = (result) => {
      const now = Date.now();
      const state = stateRef.current;
      const canWarn = now - state.lastWarningTime > 3000; // Only warn every 3 seconds

      // 1. Face Count Analysis
      const faceCount = result.faceBlendshapes ? result.faceBlendshapes.length : 0;
      
      if (faceCount === 0) {
        state.noFaceFrames++;
        if (state.noFaceFrames > 30 && canWarn) { // ~1 second of no face
          onCritical('No face detected in camera frame!');
          state.lastWarningTime = now;
        }
      } else {
        state.noFaceFrames = 0;
      }

      if (faceCount > 1 && canWarn) {
        onCritical('Multiple faces detected in frame!');
        state.lastWarningTime = now;
      }

      // 2. Head Pose / Gaze Analysis (simplified using blendshapes)
      if (faceCount === 1 && result.faceBlendshapes[0]) {
        const blendshapes = result.faceBlendshapes[0].categories;
        
        // Find eye looks
        const lookLeft = blendshapes.find(b => b.categoryName === 'eyeLookOutLeft')?.score || 0;
        const lookRight = blendshapes.find(b => b.categoryName === 'eyeLookOutRight')?.score || 0;
        const lookUp = blendshapes.find(b => b.categoryName === 'eyeLookUpLeft')?.score || 0;
        const lookDown = blendshapes.find(b => b.categoryName === 'eyeLookDownLeft')?.score || 0;

        // Arbitrary threshold for looking away (tune as needed)
        const isLookingAway = lookLeft > 0.6 || lookRight > 0.6 || lookUp > 0.6 || lookDown > 0.6;

        if (isLookingAway) {
          state.lookingAwayFrames++;
          if (state.lookingAwayFrames > 30 && canWarn) { // Looking away for ~1 second
            onEvent('warning', 'User is looking away from the screen.');
            state.lastWarningTime = now;
          }
        } else {
          state.lookingAwayFrames = 0;
        }
      }

      if (faceCount !== state.lastFaceCount) {
        if (faceCount === 1 && state.lastFaceCount === 0) {
          onEvent('info', 'Face detected. Resuming tracking.');
        }
        state.lastFaceCount = faceCount;
      }
    };

    const drawLandmarks = (result) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result.faceLandmarks) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.5)"; // Blue for landmarks
        for (const landmarks of result.faceLandmarks) {
          for (const landmark of landmarks) {
            ctx.beginPath();
            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 1.5, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }
    };

    let lastVideoTime = -1;
    const predictWebcam = async () => {
      const video = videoRef.current;
      if (!video || !faceLandmarker) return;

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const results = faceLandmarker.detectForVideo(video, performance.now());
          analyzeFace(results);
          drawLandmarks(results);
        } catch(e) {
          console.error("Inference error", e);
        }
      }
      requestAnimationFrameId = requestAnimationFrame(predictWebcam);
    };

    initializeMediaPipe();
    setupAudioDetection();

    return () => {
      if (requestAnimationFrameId) cancelAnimationFrame(requestAnimationFrameId);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (faceLandmarker) faceLandmarker.close();
      if (recognition) recognition.stop();
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, []); // Run once on mount

  return (
    <div className="video-wrapper">
      {error ? (
        <div style={{color: 'var(--danger-color)', padding: '2rem', textAlign: 'center'}}>
          {error}
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            className="webcam-feed" 
            autoPlay 
            playsInline
            muted
          ></video>
          <canvas ref={canvasRef} className="canvas-overlay"></canvas>
          <div className="video-overlay-text">
            {isModelLoaded ? 'AI Tracker Active' : 'Loading AI Model...'}
          </div>
        </>
      )}
    </div>
  );
}
