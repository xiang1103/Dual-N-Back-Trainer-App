import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import eye_pic from './assets/eye_pic.jpg';
import hearing from './assets/hearing.jpg';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const TOTAL_ROUNDS = 10;
const ROUND_TIME = 30;
const FEEDBACK_MS = 2000;
const CELL_DISPLAY_MS = 1000; // how long the cell stays lit each round

interface Round {
  cell: number;
  letter: string;
}

type GamePhase = 'idle' | 'playing' | 'feedback' | 'finished';

// Sequence is level intro rounds + TOTAL_ROUNDS game rounds
function generateSequence(n: number, total: number): Round[] {
  const seq: Round[] = [];
  for (let i = 0; i < n + total; i++) {
    seq.push({
      cell: Math.floor(Math.random() * 9),
      letter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
    });
  }
  // Inject ~30% visual and audio matches starting at game rounds
  for (let i = n; i < n + total; i++) {
    if (Math.random() < 0.3) seq[i].cell = seq[i - n].cell;
    if (Math.random() < 0.3) seq[i].letter = seq[i - n].letter;
  }
  return seq;
}

function speak(letter: string) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(letter);
  utt.rate = 0.8;
  window.speechSynthesis.speak(utt);
}

export default function App() {
  const [level, setLevel] = useState(1);
  const [feedbackMs, setFeedbackMs] = useState(FEEDBACK_MS);
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [sequence, setSequence] = useState<Round[]>([]);
  const [round, setRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [userVis, setUserVis] = useState(false);
  const [userAud, setUserAud] = useState(false);
  const [feedbackVis, setFeedbackVis] = useState<'correct' | 'wrong' | null>(null);
  const [feedbackAud, setFeedbackAud] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState({
    visHits: 0, visMatches: 0,
    audHits: 0, audMatches: 0,
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const gameStartRef = useRef<number>(0);
  const [cellVisible, setCellVisible] = useState(false);

  // Briefly light up the cell at the start of every round
  useEffect(() => {
    if (phase !== 'playing') return;
    setCellVisible(true);
    const id = setTimeout(() => setCellVisible(false), CELL_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [phase, round]);

  // Auto-advance intro rounds (round < level) — no timer, no buttons
  useEffect(() => {
    if (phase !== 'playing' || round >= level) return;
    const id = setTimeout(() => {
      const next = round + 1;
      setRound(next);
      setTimeLeft(ROUND_TIME);
      speak(sequence[next]?.letter ?? '');
    }, CELL_DISPLAY_MS + 500);
    return () => clearTimeout(id);
  }, [phase, round, level, sequence]);

  // Countdown timer — only for game rounds
  useEffect(() => {
    if (phase !== 'playing' || round < level || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, round, level, timeLeft]);

  // Evaluate when timer reaches 0 — only for game rounds
  useEffect(() => {
    if (phase !== 'playing' || round < level || timeLeft !== 0) return;
    const correctVis = sequence[round].cell === sequence[round - level].cell;
    const correctAud = sequence[round].letter === sequence[round - level].letter;
    const visOk = userVis === correctVis;
    const audOk = userAud === correctAud;
    setFeedbackVis(visOk ? 'correct' : 'wrong');
    setFeedbackAud(audOk ? 'correct' : 'wrong');
    setScore(s => ({
      visHits:    s.visHits    + (correctVis && userVis  ? 1 : 0),
      visMatches: s.visMatches + (correctVis             ? 1 : 0),
      audHits:    s.audHits    + (correctAud && userAud  ? 1 : 0),
      audMatches: s.audMatches + (correctAud             ? 1 : 0),
    }));
    setPhase('feedback');
  }, [phase, round, level, timeLeft, userVis, userAud, sequence]);

  // Advance to next round after feedback delay
  useEffect(() => {
    if (phase !== 'feedback') return;
    const id = setTimeout(() => {
      const next = round + 1;
      if (next >= level + TOTAL_ROUNDS) {
        setElapsedSeconds(Math.round((Date.now() - gameStartRef.current) / 1000));
        setPhase('finished');
      } else {
        setFeedbackVis(null);
        setFeedbackAud(null);
        setRound(next);
        setUserVis(false);
        setUserAud(false);
        setTimeLeft(ROUND_TIME);
        setPhase('playing');
        speak(sequence[next].letter);
      }
    }, feedbackMs);
    return () => clearTimeout(id);
  }, [phase, round, level, sequence, feedbackMs]);

  // Check if user's current answers are both correct; if so end round instantly
  const checkInstantWin = useCallback((vis: boolean, aud: boolean) => {
    if (round < level || sequence.length === 0) return;
    const correctVis = sequence[round].cell === sequence[round - level].cell;
    const correctAud = sequence[round].letter === sequence[round - level].letter;
    if (vis === correctVis && aud === correctAud) {
      setTimeLeft(0); // triggers the evaluate effect
    }
  }, [round, level, sequence]);

  const handleVis = useCallback(() => {
    if (phase !== 'playing' || round < level) return;
    const newVis = !userVis;
    const correctV = sequence[round].cell === sequence[round - level].cell;
    const correctA = sequence[round].letter === sequence[round - level].letter;
    setUserVis(newVis);
    // No-match round: clicking eye is instantly wrong
    if (!correctV && !correctA && newVis) {
      setTimeLeft(0);
    } else {
      checkInstantWin(newVis, userAud);
    }
  }, [phase, round, level, userVis, userAud, sequence, checkInstantWin]);

  const handleAud = useCallback(() => {
    if (phase !== 'playing' || round < level) return;
    const newAud = !userAud;
    const correctV = sequence[round].cell === sequence[round - level].cell;
    const correctA = sequence[round].letter === sequence[round - level].letter;
    setUserAud(newAud);
    // No-match round: clicking hear is instantly wrong
    if (!correctV && !correctA && newAud) {
      setTimeLeft(0);
    } else {
      checkInstantWin(userVis, newAud);
    }
  }, [phase, round, level, userVis, userAud, sequence, checkInstantWin]);

  // No Match: user asserts neither visual nor audio match — submits immediately
  const handleNoMatch = useCallback(() => {
    if (phase !== 'playing' || round < level) return;
    setUserVis(false);
    setUserAud(false);
    setTimeLeft(0); // triggers evaluate effect with both false
  }, [phase, round, level]);

  // Keyboard shortcuts: ArrowLeft = eye, ArrowRight = hear
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') handleVis();
      if (e.key === 'ArrowRight') handleAud();
      if (e.key === 'ArrowDown') handleNoMatch();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleVis, handleAud, handleNoMatch]);

  function startGame() {
    const seq = generateSequence(level, TOTAL_ROUNDS);
    setSequence(seq);
    setRound(0);
    setUserVis(false);
    setUserAud(false);
    setTimeLeft(ROUND_TIME);
    setFeedbackVis(null);
    setFeedbackAud(null);
    setScore({ visHits: 0, visMatches: 0, audHits: 0, audMatches: 0 });
    setElapsedSeconds(0);
    gameStartRef.current = Date.now();
    setPhase('playing');
    speak(seq[0].letter);
  }

  const isGameRound = round >= level;
  const isPlaying = phase === 'playing';
  const isFeedback = phase === 'feedback';

  // Show cell while cellVisible during playing; always show during feedback
  const activeCell =
    isFeedback
      ? (sequence[round]?.cell ?? null)
      : isPlaying && cellVisible
        ? (sequence[round]?.cell ?? null)
        : null;

  // Correct answers for feedback hints
  const correctVis =
    isFeedback && isGameRound && sequence.length > 0
      ? sequence[round].cell === sequence[round - level].cell
      : false;
  const correctAud =
    isFeedback && isGameRound && sequence.length > 0
      ? sequence[round].letter === sequence[round - level].letter
      : false;

  const gameRoundNum = round - level + 1; // 1-indexed display

  return (
    <div className="container">
      <header className="header">
        <h1>N = {level}</h1>
        {(isPlaying || isFeedback) && (
          <p className="round-info">
            {isGameRound ? `Round ${gameRoundNum} / ${TOTAL_ROUNDS}` : 'Watch and listen…'}
          </p>
        )}
      </header>

      <main className="grid-area">
        {phase !== 'finished' ? (
          <div className="grid-container">
            {Array(9).fill(null).map((_, i) => (
              <div key={i} className={`grid-cell${i === activeCell ? ' active' : ''}`} />
            ))}
          </div>
        ) : (
          <div className="results">
            <h2>Game Over!</h2>
            <div className="score-table">
              <div className="score-row">
                <span>Visual matches caught</span>
                <span className="score-val">{score.visHits} / {score.visMatches}</span>
              </div>
              <div className="score-row">
                <span>Audio matches caught</span>
                <span className="score-val">{score.audHits} / {score.audMatches}</span>
              </div>
              <div className="score-row">
                <span>Time played</span>
                <span className="score-val">
                  {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {(phase === 'idle' || phase === 'finished') && (
        <div className="idle-controls">
          <div className="n-picker">
            <div className="n-picker-row">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  className={`n-option${level === n ? ' active' : ''}`}
                  onClick={() => setLevel(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="n-description">
              Remember the cell and letter from <strong>{level}</strong> round{level > 1 ? 's' : ''} ago
            </p>
          </div>

          <div className="n-picker">
            <div className="n-picker-row">
              {[1000, 2000, 3000, 4000, 5000].map(ms => (
                <button
                  key={ms}
                  className={`n-option${feedbackMs === ms ? ' active' : ''}`}
                  onClick={() => setFeedbackMs(ms)}
                >
                  {ms / 1000}s
                </button>
              ))}
            </div>
            <p className="n-description">
              Between-round pause: <strong>{feedbackMs / 1000}s</strong>
            </p>
          </div>
          <button className="btn primary" onClick={startGame}>
            {phase === 'finished' ? 'Play Again' : 'Begin Game'}
          </button>
        </div>
      )}

      {/* Intro round — no buttons, just a hint */}
      {(isPlaying || isFeedback) && !isGameRound && (
        <div className="game-controls">
          <p className="intro-hint">Remember this cell and letter!</p>
        </div>
      )}

      {/* Game round — timer + buttons */}
      {(isPlaying || isFeedback) && isGameRound && (
        <div className="game-controls">
          {isPlaying ? (
            <div className={`timer-badge${timeLeft <= 10 ? ' urgent' : ''}`}>
              {timeLeft}s
            </div>
          ) : (
            <div className="timer-badge">Next…</div>
          )}

          {/* Playing: show all three input buttons */}
          {isPlaying && (
            <>
              <div className="footer">
                <button
                  className={`btn secondary${userVis ? ' selected' : ''}`}
                  onClick={handleVis}
                >
                  <img className="eye_btn" src={eye_pic} alt="seen" />
                </button>
                <button
                  className={`btn secondary${userAud ? ' selected' : ''}`}
                  onClick={handleAud}
                >
                  <img className="hear_btn" src={hearing} alt="hear" />
                </button>
              </div>
              <button className="btn no-match-btn" onClick={handleNoMatch}>
                No Match
              </button>
            </>
          )}

          {/* Feedback: show only the buttons for actual matches */}
          {isFeedback && (
            <div className="footer">
              {correctVis && (
                <button className={`btn secondary ${feedbackVis ?? ''}`} disabled>
                  <img className="eye_btn" src={eye_pic} alt="seen" />
                </button>
              )}
              {correctAud && (
                <button className={`btn secondary ${feedbackAud ?? ''}`} disabled>
                  <img className="hear_btn" src={hearing} alt="hear" />
                </button>
              )}
              {!correctVis && !correctAud && (
                <div className={`no-match-result ${feedbackVis === 'correct' ? 'correct' : 'wrong'}`}>
                  No Match
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}