import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Moon,
  Sun,
  Settings2,
  HelpCircle
} from "lucide-react";
import "./ios.css";
import "./App.css";
import * as Dialog from "@radix-ui/react-dialog";
import { Session } from "./types";
import { storage } from "./utils/storage";
import { CommandPalette } from "./components/CommandPalette";
import { questionCache } from "./utils/questionCache";

interface Question {
  question: string;
  answers: string[];
  correct: string;
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [direction, setDirection] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<Array<[Question, string]>>(
    []
  );
  const [showReview, setShowReview] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [numberOfQuestions] = useState<number | "all">(
    "all"
  );
  const [isDark, setIsDark] = useState(false);
  const [textAnswer, setTextAnswer] = useState<string>("");
  const [focusedAnswerIndex, setFocusedAnswerIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(
    new Set()
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [testQuestionCount, setTestQuestionCount] = useState(100);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [previousQuestionIndex, setPreviousQuestionIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        // Try to get questions from cache first
        const cachedQuestions = await questionCache.getCachedQuestions();
        if (cachedQuestions) {
          setQuestions(cachedQuestions);
          return;
        }

        // If not in cache, fetch from file
        const response = await fetch("/questions.json");
        const data = await response.json();
        setQuestions(data);

        // Cache the questions for future use
        await questionCache.cacheQuestions(data);
      } catch (error) {
        console.error("Error loading questions:", error);
      }
    };

    loadQuestions();
  }, []);

  useEffect(() => {
    // Check system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Initialize storage on mount
  useEffect(() => {
    storage.init();
  }, []);

  // Load sessions from file
  useEffect(() => {
    const loadSavedSessions = async () => {
      try {
        const { sessions: savedSessions, currentSessionId } =
          await storage.loadSessions();
        if (savedSessions.length) {
          setSessions(savedSessions);

          if (currentSessionId) {
            const currentSession = savedSessions.find(
              (s) => s.id === currentSessionId
            );
            if (currentSession && !currentSession.completed) {
              setCurrentSession(currentSession);
              setCurrentQuestionIndex(currentSession.currentQuestionIndex);
              setScore(currentSession.score);
              setAnsweredQuestions(new Set(currentSession.answeredQuestions));
            }
          }
        }
      } catch (error) {
        console.error("Error loading sessions:", error);
      }
    };

    loadSavedSessions();
  }, []);

  // Save sessions to file when updated
  useEffect(() => {
    const saveSessionsToFile = async () => {
      try {
        await storage.saveSessions(sessions, currentSession?.id);
      } catch (error) {
        console.error("Error saving sessions:", error);
      }
    };

    saveSessionsToFile();
  }, [sessions, currentSession]);

  const currentQuestion = currentSession
    ? questions[currentSession.questionIds[currentQuestionIndex]]
    : questions[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    if (!isAnswerSubmitted) {
      setSelectedAnswer(answer);
    }
  };

  const isCorrectAnswer = (
    answer: string,
    question: Question
  ): boolean => {
    if (question.answers.length === 0) {
      // For text input questions
      return answer.toLowerCase() === question.correct.toLowerCase();
    }

    // For True/False questions - direct comparison
    return answer === question.correct;
  };

  const handleSubmit = async () => {
    if ((!selectedAnswer && !textAnswer) || isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);

    if (!answeredQuestions.has(currentQuestionIndex)) {
      if (isCorrectAnswer(selectedAnswer, currentQuestion)) {
        setScore((prev) => prev + 1);
      } else {
        setWrongAnswers((prev) => [
          ...prev,
          [currentQuestion, selectedAnswer],
        ]);
      }
      setAnsweredQuestions((prev) => new Set(prev).add(currentQuestionIndex));
    }
  };

  const handleNext = () => {
    const maxQuestions = currentSession 
      ? currentSession.totalQuestions
      : numberOfQuestions === "all"
        ? questions.length
        : Math.min(numberOfQuestions, questions.length);

    if (currentQuestionIndex < maxQuestions - 1) {
      setDirection(1);
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer("");
      setTextAnswer("");
      setIsAnswerSubmitted(false);
    } else {
      setGameOver(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setDirection(-1);
      setCurrentQuestionIndex((prev) => prev - 1);
      setSelectedAnswer("");
      setIsAnswerSubmitted(false);
    }
  };

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  // Update the keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if we're in an input field
      if (e.target instanceof HTMLInputElement) return;
      if (!currentQuestion) return;

      switch (e.key) {
        case "Enter":
          // Submit answer or go to next question
          if (isAnswerSubmitted) {
            handleNext();
                      } else if (
              (currentQuestion.answers.length > 0 &&
                selectedAnswer) ||
              (currentQuestion.answers.length === 0 && textAnswer.length > 0)
            ) {
            handleSubmit();
          }
          break;

        case " ": // Space
          if (
            currentQuestion.answers.length > 0 &&
            focusedAnswerIndex >= 0 &&
            !isAnswerSubmitted
          ) {
            e.preventDefault(); // Prevent page scroll
            handleAnswerSelect(currentQuestion.answers[focusedAnswerIndex]);
          }
          break;

        case "ArrowUp":
          if (currentQuestion.answers.length > 0) {
            e.preventDefault();
            setFocusedAnswerIndex((prev) =>
              prev <= 0 ? currentQuestion.answers.length - 1 : prev - 1
            );
          }
          break;

        case "ArrowDown":
          if (currentQuestion.answers.length > 0) {
            e.preventDefault();
            setFocusedAnswerIndex((prev) =>
              prev >= currentQuestion.answers.length - 1 ? 0 : prev + 1
            );
          }
          break;

        case "Tab":
          if (currentQuestion.answers.length > 0) {
            e.preventDefault();
            if (e.shiftKey) {
              setFocusedAnswerIndex((prev) =>
                prev <= 0 ? currentQuestion.answers.length - 1 : prev - 1
              );
            } else {
              setFocusedAnswerIndex((prev) =>
                prev >= currentQuestion.answers.length - 1 ? 0 : prev + 1
              );
            }
          }
          break;

        // Number keys 1-9 for quick answer selection
        default:
          const num = parseInt(e.key);
          if (
            !isAnswerSubmitted &&
            currentQuestion.answers.length > 0 &&
            num >= 1 &&
            num <= currentQuestion.answers.length
          ) {
            handleAnswerSelect(currentQuestion.answers[num - 1]);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentQuestion,
    focusedAnswerIndex,
    isAnswerSubmitted,
    selectedAnswer,
    textAnswer,
  ]);

  // Reset focused answer when question changes
  useEffect(() => {
    setFocusedAnswerIndex(-1);
  }, [currentQuestionIndex]);

  // Add a new useEffect to focus the input when the question changes
  useEffect(() => {
    if (currentQuestion && currentQuestion.answers.length === 0) {
      inputRef.current?.focus();
    }
  }, [currentQuestion]);

  // Update the className and style for all main container divs
  const containerClass =
    "min-h-screen bg-[var(--ios-background)] text-[var(--ios-text)]";
  const cardClass =
    "bg-[var(--ios-card-background)] border border-[var(--ios-border)]";

  const createNewSession = (questionCount: number, isTest: boolean = false) => {
    let questionIds: number[];
    
    const allIndices = Array.from({ length: questions.length }, (_, i) => i);
    questionIds = [];
    const count = Math.min(questionCount, questions.length);

    for (let i = allIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
    }

    questionIds = allIndices.slice(0, count);

    const newSession: Session = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      totalQuestions: questionIds.length,
      currentQuestionIndex: 0,
      score: 0,
      isTest,
      questionIds,
      answeredQuestions: [],
      completed: false,
    };

    setSessions((prev) => [...prev, newSession]);
    setCurrentSession(newSession);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnsweredQuestions(new Set());
    setWrongAnswers([]);
    setShowReview(false);
    setGameOver(false);
    setSelectedAnswer("");
    setTextAnswer("");
    setIsAnswerSubmitted(false);
    setFocusedAnswerIndex(-1);
    setIsViewMode(false);
    setPreviousQuestionIndex(null);
  };

  const resumeSession = (session: Session) => {
    setCurrentSession(session);
    setCurrentQuestionIndex(session.currentQuestionIndex);
    setScore(session.score);
    setAnsweredQuestions(new Set(session.answeredQuestions));
  };

  // Update the current session progress
  useEffect(() => {
    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        currentQuestionIndex,
        score,
        answeredQuestions: Array.from(answeredQuestions),
        completed: gameOver,
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSession.id ? updatedSession : s))
      );
      setCurrentSession(updatedSession);
    }
  }, [currentQuestionIndex, score, answeredQuestions, gameOver]);

  // Add delete session function
  const deleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
    }
  };
  
  // Add keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Add command palette handler
  const handleQuestionSelect = (index: number) => {
    if (!isViewMode) {
      setPreviousQuestionIndex(currentQuestionIndex);
    }
    setCurrentQuestionIndex(index);
    setSelectedAnswer("");
    setTextAnswer("");
    setIsAnswerSubmitted(false);
    setIsViewMode(true);
  };

  // Add handler for resuming practice
  const handleResumePractice = () => {
    setIsViewMode(false);
    if (currentSession) {
      if (previousQuestionIndex !== null) {
        setCurrentQuestionIndex(previousQuestionIndex);
        setPreviousQuestionIndex(null);
      }
    } else {
      createNewSession(questions.length);
    }
  };

  if (!questions.length) {
    return (
      <div className={`${containerClass} flex items-center justify-center p-4`}>
        <div className="w-full max-w-3xl mx-auto">
          <div className="animate-pulse text-[var(--ios-text-secondary)]">
            Loading questions...
          </div>
        </div>
      </div>
    );
  }

  if (gameOver) {
    const totalQuestions = currentSession?.totalQuestions || questions.length;
    const percentage = (score / totalQuestions) * 100;
    const wrongCount = wrongAnswers.length;
    const correctCount = score;

    // Add review mistakes interface
    if (showReview) {
      return (
        <div className={`${containerClass} flex flex-col items-center gap-4 p-4`}>
          <div
            className={`w-full max-w-3xl ${cardClass} rounded-[18px] overflow-hidden shadow-lg p-6`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-semibold">Review Mistakes</h2>
              <button
                onClick={() => setShowReview(false)}
                className="text-[var(--ios-blue)] text-[17px]"
              >
                Back to Results
              </button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {wrongAnswers.map(([question, userAnswer], index) => (
                <div key={index} className="p-4 rounded-[14px] bg-[var(--ios-background)] border border-[var(--ios-border)]">
                  <h3 className="text-[17px] font-medium mb-4">{question.question}</h3>
                  
                  <div className="space-y-2">
                    {question.answers.map((answer, answerIndex) => (
                      <div
                        key={answerIndex}
                        className={`p-3 rounded-[10px] text-[15px] ${
                          answer === question.correct
                            ? "bg-[var(--ios-green-light)] text-[var(--ios-green)] border border-[var(--ios-green)]"
                            : answer === userAnswer
                            ? "bg-[var(--ios-red-light)] text-[var(--ios-red)] border border-[var(--ios-red)]"
                            : "bg-[var(--ios-card-background)]"
                        }`}
                      >
                        <span className="font-medium">
                          {String.fromCharCode(97 + answerIndex)})
                        </span>{" "}
                        {answer}
                        {answer === question.correct && (
                          <span className="ml-2 text-[13px] font-medium">✓ Correct</span>
                        )}
                        {answer === userAnswer && answer !== question.correct && (
                          <span className="ml-2 text-[13px] font-medium">✗ Your Answer</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${containerClass} flex flex-col items-center gap-4 p-4`}>
        <div
          className={`w-full max-w-3xl ${cardClass} rounded-[18px] overflow-hidden shadow-lg p-6`}
        >
          <h2 className="text-[22px] font-semibold mb-6">Session Complete!</h2>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center py-2 border-b border-[var(--ios-border)]">
              <span className="text-[var(--ios-text-secondary)]">
                Session Type
              </span>
              <span className="font-medium">
                {currentSession?.isTest ? "Test" : "Practice"}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[var(--ios-border)]">
              <span className="text-[var(--ios-text-secondary)]">
                Questions Completed
              </span>
              <span className="font-medium">{totalQuestions}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[var(--ios-border)]">
              <span className="text-[var(--ios-text-secondary)]">
                Correct Answers
              </span>
              <span className="text-[var(--ios-green)]">{correctCount}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[var(--ios-border)]">
              <span className="text-[var(--ios-text-secondary)]">
                Wrong Answers
              </span>
              <span className="text-[var(--ios-red)]">{wrongCount}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[var(--ios-border)]">
              <span className="text-[var(--ios-text-secondary)]">
                Final Score
              </span>
              <span className="text-[var(--ios-blue)] font-semibold">
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {wrongCount > 0 && (
              <button
                className="w-full py-3 rounded-[14px] bg-[var(--ios-blue-light)] text-[var(--ios-blue)]"
                onClick={() => setShowReview(true)}
              >
                Review Mistakes
              </button>
            )}
            
            {currentSession?.isTest ? (
              // Test completion options
              <>
                <button
                  className="w-full py-3 rounded-[14px] bg-[var(--ios-blue-light)] text-[var(--ios-blue)]"
                  onClick={() => {
                    createNewSession(testQuestionCount, true);
                  }}
                >
                  Take Test Again
                </button>
                <button
                  className="w-full py-3 rounded-[14px] bg-[var(--ios-green-light)] text-[var(--ios-green)]"
                  onClick={() => {
                    createNewSession(questions.length, false);
                  }}
                >
                  Switch to Practice Mode
                </button>
              </>
            ) : (
              // Practice completion options
              <button
                className="w-full py-3 rounded-[14px] bg-[var(--ios-blue-light)] text-[var(--ios-blue)]"
                onClick={() => {
                  createNewSession(questions.length, false);
                }}
              >
                Practice Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`${containerClass} flex flex-col items-center justify-center p-4`}
      >
        <div
          className={`w-full max-w-3xl ${cardClass} rounded-[18px] overflow-hidden shadow-lg`}
        >
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--ios-border)]">
            <button
              onClick={handlePrevious}
              className={`flex items-center text-[var(--ios-blue)] transition-opacity ${
                currentQuestionIndex === 0 ? "opacity-50" : "opacity-100"
              }`}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-[17px]">Back</span>
            </button>
            <span className="text-[17px]">Quiz</span>
            <button
              onClick={toggleDarkMode}
              className="w-[60px] flex justify-end text-[var(--ios-blue)]"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          <div className="p-6 overflow-hidden">
            <div className="text-[17px] text-[var(--ios-text-secondary)] mb-2">
              Question {currentQuestionIndex + 1} of{" "}
              {currentSession?.totalQuestions || questions.length}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{
                  opacity: 0,
                  x: direction * 20,
                  filter: "blur(10px)",
                }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: direction * -20, filter: "blur(10px)" }}
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                  filter: { duration: 0.2 },
                }}
                className="relative"
              >
                <p className="text-[22px] mb-8">{currentQuestion.question}</p>

                <div className="space-y-3">
                  {currentQuestion.answers.map((answer, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      onClick={() => handleAnswerSelect(answer)}
                      onFocus={() => setFocusedAnswerIndex(index)}
                      disabled={isAnswerSubmitted}
                      className={`w-full text-left py-3.5 px-5 rounded-[14px] text-[17px] transition-all outline-none
                        ${
                          selectedAnswer === answer &&
                          !isAnswerSubmitted
                            ? "bg-[var(--ios-blue-light)] text-[var(--ios-blue)]"
                            : "bg-[var(--ios-background)]"
                        } ${
                        isAnswerSubmitted &&
                        isCorrectAnswer(answer, currentQuestion)
                          ? "bg-[var(--ios-green-light)] text-[var(--ios-green)]"
                          : ""
                      } ${
                        isAnswerSubmitted &&
                        selectedAnswer === answer &&
                        !isCorrectAnswer(answer, currentQuestion)
                          ? "bg-[var(--ios-red-light)] text-[var(--ios-red)]"
                          : ""
                      } ${
                        focusedAnswerIndex === index
                          ? "ring-2 ring-[var(--ios-blue)] ring-offset-2"
                          : ""
                      }`}
                    >
                      {String.fromCharCode(97 + index)}) {answer}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-6 py-4 flex justify-between items-center border-t border-[#E5E5EA]">
            {isViewMode ? (
              <div className="text-[17px] text-[var(--ios-text-secondary)]">
                View Mode
              </div>
            ) : (
              <div className="text-[17px] text-[var(--ios-text-secondary)]">
                Score: {score}/
                {currentSession?.totalQuestions || questions.length}
              </div>
            )}
            <div className="flex gap-2">
              {isViewMode && (
                <button
                  onClick={handleResumePractice}
                  className="px-7 py-2.5 rounded-[14px] text-[17px] bg-[var(--ios-blue-light)] text-[var(--ios-blue)]"
                >
                  Resume Practice
                </button>
              )}
              {!isViewMode && (
                <>

                  {!isAnswerSubmitted ? (
                    <button
                      onClick={handleSubmit}
                      disabled={!selectedAnswer}
                      className={`px-7 py-2.5 rounded-[14px] text-[17px] transition-all
                        ${
                          !selectedAnswer
                            ? "bg-[var(--ios-background)] text-[var(--ios-text-secondary)]"
                            : "bg-[var(--ios-blue-light)] text-[var(--ios-blue)]"
                        }`}
                    >
                      Submit
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="px-7 py-2.5 rounded-[14px] text-[17px] bg-[var(--ios-blue-light)] text-[var(--ios-blue)]"
                    >
                      Next Question
                    </button>
                  )}
                </>
              )}
            </div>
          </div>


        </div>
      </div>

      {/* Add keyboard shortcut hint */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 text-[13px] text-[var(--ios-text-secondary)]">
        Press {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + K to search
        questions
      </div>

      {/* Settings and History Panel */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
        <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <Dialog.Trigger asChild>
            <button className="p-3 rounded-full bg-[var(--ios-card-background)] border border-[var(--ios-border)] text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)] transition-colors">
              <Settings2 size={20} />
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed bottom-[100px] left-1/2 -translate-x-1/2 w-[90%] max-w-md p-6 rounded-[18px] bg-[var(--ios-card-background)] border border-[var(--ios-border)] shadow-lg text-[var(--ios-text)]">
              <Dialog.Title className="text-[22px] mb-4">Settings</Dialog.Title>
              
              <div className="space-y-4 mb-3">
                <div>
                  <label className="text-[15px] text-[var(--ios-text-secondary)]">
                    Test Question Count
                  </label>
                  <input
                    type="number"
                    value={testQuestionCount}
                    onChange={(e) => {
                      const value = Math.max(
                        1,
                        Math.min(questions.length, Number(e.target.value))
                      );
                      setTestQuestionCount(value);
                    }}
                    className="w-full mt-1 px-4 py-2 rounded-[10px] bg-[var(--ios-background)] border border-[var(--ios-border)] text-[var(--ios-text)]"
                    min="1"
                    max={questions.length}
                    placeholder="Enter number of questions"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      createNewSession(testQuestionCount, true);
                      setIsSettingsOpen(false);
                    }}
                    className="w-full py-3 rounded-[14px] bg-[var(--ios-blue-light)] text-[var(--ios-blue)] text-[17px]"
                  >
                    Start Test
                  </button>
                  <button
                    onClick={() => {
                      createNewSession(questions.length, false);
                      setIsSettingsOpen(false);
                    }}
                    className="w-full py-3 rounded-[14px] bg-[var(--ios-green-light)] text-[var(--ios-green)] text-[17px]"
                  >
                    Practice Mode
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-[17px] mb-3">Recent Sessions</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {sessions
                    .slice()
                    .reverse()
                    .map((session) => (
                      <div
                        key={session.id}
                        className="p-3 rounded-[14px] bg-[var(--ios-background)] flex justify-between items-center"
                      >
                        <div className="flex-1">
                          <p className="text-[15px] text-[var(--ios-text)]">
                            {session.isTest ? "Test" : "Practice"} -{" "}
                            {new Date(session.timestamp).toLocaleDateString()}
                          </p>
                          <p className="text-[13px] text-[var(--ios-text-secondary)]">
                            Progress: {session.currentQuestionIndex}/
                            {session.totalQuestions}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!session.completed && (
                            <button
                              onClick={() => {
                                resumeSession(session);
                                setIsSettingsOpen(false);
                              }}
                              className="px-4 py-1 rounded-[8px] bg-[var(--ios-blue-light)] text-[var(--ios-blue)] text-[13px]"
                            >
                              Resume
                            </button>
                          )}
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="px-4 py-1 rounded-[8px] bg-[var(--ios-red-light)] text-[var(--ios-red)] text-[13px]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <button
          onClick={() => setIsHelpOpen(true)}
          className="p-3 rounded-full bg-[var(--ios-card-background)] border border-[var(--ios-border)] text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)] transition-colors"
        >
          <HelpCircle size={20} />
        </button>
      </div>

      <Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed bottom-[100px] left-1/2 -translate-x-1/2 w-[90%] max-w-md p-6 rounded-[18px] bg-[var(--ios-card-background)] border border-[var(--ios-border)] shadow-lg text-[var(--ios-text)]">
            <Dialog.Title className="text-[22px] mb-4">
              Keyboard Shortcuts
            </Dialog.Title>
            <div className="space-y-3">
              <div>
                <h3 className="text-[17px] mb-2">Navigation</h3>
                <ul className="space-y-2 text-[15px] text-[var(--ios-text-secondary)]">
                  <li>↑/↓ - Navigate between answers</li>
                  <li>Tab/Shift+Tab - Cycle through answers</li>
                  <li>Enter - Submit answer or go to next question</li>
                  <li>Space - Select/deselect focused answer</li>
                  <li>
                    {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + K -
                    Search questions
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-[17px] mb-2">Quick Selection</h3>
                <p className="text-[15px] text-[var(--ios-text-secondary)]">
                  Use number keys (1-2) to quickly select True/False
                </p>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Add CommandPalette component */}
      <CommandPalette
        questions={questions}
        onQuestionSelect={handleQuestionSelect}
        isOpen={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />
    </>
  );
}

export default App;
