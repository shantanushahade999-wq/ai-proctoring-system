import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Activity, Eye, CopyX } from 'lucide-react';
import ProctoringEngine from './ProctoringEngine';
import './index.css';

const MCQ_QUESTIONS = [
  {
    id: 1,
    question: "What is the primary function of an activation function in a Neural Network?",
    options: [
      "To initialize the weights of the network",
      "To introduce non-linearity into the output of a neuron",
      "To calculate the loss function",
      "To normalize the input data"
    ],
    correctAnswer: 1
  },
  {
    id: 2,
    question: "Which of the following is NOT a type of Recurrent Neural Network (RNN)?",
    options: [
      "Long Short-Term Memory (LSTM)",
      "Gated Recurrent Unit (GRU)",
      "Convolutional Neural Network (CNN)",
      "Echo State Network"
    ],
    correctAnswer: 2
  },
  {
    id: 3,
    question: "What does 'Gradient Descent' aim to minimize?",
    options: [
      "The number of epochs",
      "The learning rate",
      "The loss function",
      "The number of hidden layers"
    ],
    correctAnswer: 2
  }
];

function App() {
  const [logs, setLogs] = useState([]);
  const [examStatus, setExamStatus] = useState('active');
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  
  // MCQ State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { questionIndex: optionIndex }
  const [isExamFinished, setIsExamFinished] = useState(false);
  const [score, setScore] = useState(0);

  const addLog = (type, message) => {
    if (isExamFinished && (type === 'danger' || type === 'warning')) return; // Ignore new violations if exam is over
    
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      type,
      message,
      time: new Date().toLocaleTimeString()
    }]);
    
    if (type === 'danger' || type === 'warning') {
      setExamStatus('warning');
      setTimeout(() => {
        setExamStatus('active');
      }, 3000);
    }
  };

  const handleCriticalViolation = (message) => {
    if (isExamFinished) return;
    setWarningMessage(message);
    setShowWarning(true);
    addLog('danger', message);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isExamFinished) {
        handleCriticalViolation('Tab switched or window minimized!');
      }
    };

    const preventCopyPaste = (e) => {
      e.preventDefault();
      handleCriticalViolation(`Attempted to ${e.type} content!`);
    };
    
    const preventContextMenu = (e) => {
      e.preventDefault();
      addLog('warning', 'Right-click disabled during exam.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', preventCopyPaste);
    document.addEventListener('cut', preventCopyPaste);
    document.addEventListener('paste', preventCopyPaste);
    document.addEventListener('contextmenu', preventContextMenu);

    addLog('info', 'Proctoring session started.');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', preventCopyPaste);
      document.removeEventListener('cut', preventCopyPaste);
      document.removeEventListener('paste', preventCopyPaste);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [isExamFinished]);

  const handleOptionSelect = (optionIndex) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: optionIndex
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < MCQ_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    let calculatedScore = 0;
    MCQ_QUESTIONS.forEach((q, index) => {
      if (userAnswers[index] === q.correctAnswer) {
        calculatedScore += 1;
      }
    });
    setScore(calculatedScore);
    setIsExamFinished(true);
    addLog('info', 'Exam submitted successfully. Proctoring ended.');
  };

  const currentQuestion = MCQ_QUESTIONS[currentQuestionIndex];

  return (
    <div className="app-container">
      <main className="main-content">
        <header className="exam-header">
          <div className="exam-title">
            <Activity className="text-primary-color" size={24} color="var(--primary-color)"/>
            Computer Science Final Exam
          </div>
          <div className={`exam-status ${examStatus === 'warning' ? 'warning' : ''}`}>
            {examStatus === 'active' ? (
              <><CheckCircle size={18} /> Monitoring Active</>
            ) : (
              <><AlertTriangle size={18} /> Violation Detected</>
            )}
          </div>
        </header>

        <div className="exam-workspace">
          <div className="glass-panel question-card">
            {isExamFinished ? (
              <div className="results-container text-center" style={{textAlign: 'center', padding: '2rem'}}>
                <div style={{display: 'flex', justifyContent: 'center', marginBottom: '1rem'}}>
                   <CheckCircle size={64} color="var(--success-color)" />
                </div>
                <h1 style={{fontSize: '2rem', marginBottom: '1rem'}}>Exam Completed</h1>
                <p style={{fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '2rem'}}>
                  Your final score is:
                </p>
                <div className="score-display" style={{fontSize: '4rem', fontWeight: 'bold', color: 'var(--primary-color)'}}>
                  {score} / {MCQ_QUESTIONS.length}
                </div>
              </div>
            ) : (
              <>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: 'var(--text-muted)'}}>
                  <span>Question {currentQuestionIndex + 1} of {MCQ_QUESTIONS.length}</span>
                  <span>Answered: {Object.keys(userAnswers).length}</span>
                </div>
                
                <h2 className="question-title" style={{fontSize: '1.25rem', marginBottom: '2rem'}}>
                  {currentQuestionIndex + 1}. {currentQuestion.question}
                </h2>
                
                <div className="options-container" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {currentQuestion.options.map((option, index) => (
                    <div 
                      key={index} 
                      className={`mcq-option ${userAnswers[currentQuestionIndex] === index ? 'selected' : ''}`}
                      onClick={() => handleOptionSelect(index)}
                      style={{
                        padding: '1rem 1.5rem',
                        border: `1px solid ${userAnswers[currentQuestionIndex] === index ? 'var(--primary-color)' : 'var(--surface-border)'}`,
                        borderRadius: '8px',
                        background: userAnswers[currentQuestionIndex] === index ? 'rgba(59, 130, 246, 0.1)' : 'rgba(15, 23, 42, 0.5)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <input 
                        type="radio" 
                        name={`q-${currentQuestionIndex}`} 
                        checked={userAnswers[currentQuestionIndex] === index}
                        onChange={() => {}}
                        style={{marginRight: '1rem', cursor: 'pointer'}}
                      />
                      {option}
                    </div>
                  ))}
                </div>

                <div className="exam-controls" style={{display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--surface-border)'}}>
                  <button 
                    onClick={handlePrev} 
                    disabled={currentQuestionIndex === 0}
                    className="nav-btn"
                    style={{padding: '0.75rem 1.5rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--surface-border)', color: currentQuestionIndex === 0 ? 'var(--text-muted)' : 'var(--text-main)', cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer'}}
                  >
                    Previous
                  </button>
                  
                  {currentQuestionIndex === MCQ_QUESTIONS.length - 1 ? (
                    <button 
                      onClick={handleSubmit}
                      className="submit-btn"
                      style={{padding: '0.75rem 1.5rem', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '500'}}
                    >
                      Submit Exam
                    </button>
                  ) : (
                    <button 
                      onClick={handleNext}
                      className="nav-btn"
                      style={{padding: '0.75rem 1.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer'}}
                    >
                      Next
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Proctoring Dashboard Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <ShieldAlert size={20} color="var(--primary-color)"/>
          Live Proctoring
        </div>
        
        <div className="video-container">
          <ProctoringEngine onEvent={addLog} onCritical={handleCriticalViolation} />
        </div>

        <div className="sidebar-header" style={{borderTop: '1px solid var(--surface-border)', borderBottom: 'none'}}>
          <Activity size={20} color="var(--primary-color)"/>
          Activity Log
        </div>
        
        <div className="logs-container">
          {logs.length === 0 ? (
            <div className="empty-logs">No activity recorded yet</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`log-item ${log.type}`}>
                <div style={{flex: 1}}>{log.message}</div>
                <div className="log-time">{log.time}</div>
              </div>
            )).reverse()
          )}
        </div>
      </aside>

      {showWarning && !isExamFinished && (
        <div className="full-screen-warning">
          <div className="warning-icon-large">
            <AlertTriangle size={64} />
          </div>
          <h1 className="warning-text-large">Violation Detected</h1>
          <p style={{fontSize: '1.125rem', color: 'var(--text-muted)'}}>{warningMessage}</p>
          <button 
            className="dismiss-btn"
            onClick={() => setShowWarning(false)}
          >
            I understand, resume exam
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
