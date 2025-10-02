import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Button, Typography, App } from 'antd';
import { SoundOutlined, StepForwardOutlined } from '@ant-design/icons';
import { setCurrentQuestion, updateTimer, advanceQuestion, setFinalResults } from '../store/slices/interviewSlice';
import { updateCandidate } from '../store/slices/candidatesSlice';
import apiService from '../services/api';

const { Title, Text } = Typography;

const ChatInterface = () => {
  const dispatch = useDispatch();
  const { message } = App.useApp();
  const { 
    currentQuestion, 
    questionNumber, 
    timeRemaining, 
    currentCandidate
  } = useSelector(state => state.interview);
  const preloadedQuestions = useSelector(state => state.interview.preloadedQuestions || []);
  
  const [loading, setLoading] = useState(false);
  const [preCountdown, setPreCountdown] = useState(0);
  const [preSpeakCountdown, setPreSpeakCountdown] = useState(0); // 3s before TTS
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordedBlobsRef = useRef([]); // store raw recordings for batch processing later
  const ttsUtteranceRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  const getFemaleVoice = () => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const preferredNames = [
      'Google UK English Female',
      'Google US English',
      'Microsoft Zira',
      'Samantha',
      'Victoria',
      'Veena',
      'Kathy'
    ];
    for (const name of preferredNames) {
      const voice = voices.find(v => v.name.includes(name));
      if (voice) return voice;
    }
    const female = voices.find(v => /female/i.test(v.name));
    return female || voices[0] || null;
  };

  // State to control when answer timer should start
  const [answerTimerActive, setAnswerTimerActive] = useState(false);

  // show a 3s pre-speak countdown, then TTS the question, then a 5s pre-response countdown
  useEffect(() => {
    if (!currentQuestion) return;
    setAnswerTimerActive(false);
    setPreCountdown(0);
    setPreSpeakCountdown(3);
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const startTTS = () => {
          const speak = () => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
            // Tune voice
            utterance.rate = 1.05;
            utterance.pitch = 1.05;
            utterance.lang = 'en-US';
            const voice = getFemaleVoice();
            if (voice) utterance.voice = voice;
            ttsUtteranceRef.current = utterance;
            utterance.onend = () => setPreCountdown(5);
            window.speechSynthesis.speak(utterance);
          };
          // wait for preSpeakCountdown to reach 0 before speaking
          const interval = setInterval(() => {
            setPreSpeakCountdown(prev => {
              if (prev > 1) return prev - 1;
              clearInterval(interval);
              speak();
              return 0;
            });
          }, 1000);
        };
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) window.speechSynthesis.onvoiceschanged = startTTS; else startTTS();
      }
    } catch (err) {
      console.log(err);
    }
  }, [currentQuestion]);

  // 5s pre-response countdown, then start recording and the answer timer
  useEffect(() => {
    if (preCountdown <= 0) return;
    const t = setTimeout(() => setPreCountdown(preCountdown - 1), 1000);
    if (preCountdown === 1) setTimeout(() => {
      startRecording();
      setAnswerTimerActive(true);
    }, 50);
    return () => clearTimeout(t);
  }, [preCountdown]);

  // timer countdown (only when answerTimerActive is true)
  useEffect(() => {
    if (!currentQuestion || !answerTimerActive) return;
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        dispatch(updateTimer(timeRemaining - 1));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      stopRecordingAndSubmit(true);
      setAnswerTimerActive(false);
    }
  }, [timeRemaining, currentQuestion, dispatch, answerTimerActive]);

  // start recording
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices) {
        message.error('Media devices not supported.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        await handleRecordedAnswer();
      };
      mediaRecorderRef.current = recorder;
  recorder.start();

      // Setup waveform visualizer
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyserRef.current = analyser;

        const canvas = canvasRef.current;
        const canvasCtx = canvas?.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          analyser.getByteTimeDomainData(dataArray);
          if (canvas && canvasCtx) {
            const { width, height } = canvas;
            canvasCtx.clearRect(0, 0, width, height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#1677ff';
            canvasCtx.beginPath();

            const sliceWidth = width / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = (v * height) / 2;
              if (i === 0) canvasCtx.moveTo(x, y);
              else canvasCtx.lineTo(x, y);
              x += sliceWidth;
            }
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
          }
          animationRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (_) {}
    } catch (err) {
      message.error('Unable to access microphone.');
    }
  };

  const stopRecordingAndSubmit = async (auto = false) => {
    try {
      if (ttsUtteranceRef.current) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        await handleRecordedAnswer(auto);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    } catch (_) {}
  };

  const handleRecordedAnswer = async (auto = false) => {
    try {
      // Persist the recorded blob (or null if timed out/skip)
      let blob = null;
      if (audioChunksRef.current.length > 0) {
        blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      }
      recordedBlobsRef.current.push(blob);

      // Move to next question or finish
      if (questionNumber >= 6) {
        // Batch process all recordings
        setLoading(true);
        try {
          const formData = new FormData();
          // candidateInfo omitted intentionally; scoring is based on answers only
          const payload = { questions: preloadedQuestions };
          formData.append('payload', JSON.stringify(payload));
          recordedBlobsRef.current.forEach((b, idx) => {
            if (b) formData.append('audios', new File([b], `q${idx + 1}.webm`, { type: 'audio/webm' }));
            else formData.append('audios', new Blob([], { type: 'application/octet-stream' }), `q${idx + 1}-empty.bin`);
          });
          const batch = await apiService.batchEvaluateWithFormData(formData);
          if (!batch?.success) throw new Error(batch?.error || 'Batch evaluation failed');
          const answersArr = batch.transcripts || [];
          const scoresArr = (batch.evaluations || []).map(e => e?.score || 0);
          const feedbacksArr = (batch.evaluations || []).map(e => e?.feedback || "");

          // Generate summary
          const allQuestions = preloadedQuestions.map(q => q.question);
          const summaryResult = await apiService.generateSummary(
            currentCandidate,
            allQuestions,
            answersArr,
            scoresArr
          );

          // Update store and candidate
          dispatch(setFinalResults({ answers: answersArr, scores: scoresArr, feedbacks: feedbacksArr }));
          dispatch(updateCandidate({
            id: currentCandidate.id,
            status: 'completed',
            finalScore: summaryResult.averageScore,
            summary: summaryResult.summary,
            questions: allQuestions,
            answers: answersArr,
            scores: scoresArr,
            feedbacks: feedbacksArr,
            completedAt: new Date().toISOString()
          }));
          message.success('Interview completed successfully!');
        } catch (err) {
          message.error(err?.message || 'Failed to process recordings.');
        } finally {
          setLoading(false);
        }
      } else {
        const nextIndex = questionNumber; // zero-based for next
        const next = preloadedQuestions[nextIndex];
        dispatch(advanceQuestion());
        if (next) {
          dispatch(setCurrentQuestion(next));
        } else {
          message.error('No more preloaded questions available.');
        }
      }
    } finally {
      // Reset buffers and teardown visualizer
      audioChunksRef.current = [];
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) {
        try { if (audioContextRef.current.state !== 'closed') audioContextRef.current.close(); } catch (_) {}
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {!loading && currentQuestion && preSpeakCountdown > 0 && (
        <Card className="shadow-md border border-gray-100 rounded-xl text-center">
          <div className="py-10">
            <Title level={3} className="mb-2">Get ready…</Title>
            <div className="text-6xl font-bold text-blue-600">{preSpeakCountdown}</div>
            <div className="mt-3 text-gray-500">Your next question will start shortly</div>
          </div>
        </Card>
      )}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <Card className="shadow-md border border-gray-100 rounded-xl text-center">
            <Title level={4}>Evaluating your responses</Title>
            <div className="flex justify-center my-3">
              <span className="animate-spin inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
            </div>
            <Text type="secondary">We’re scoring your responses. This may take up to a minute. Please keep this tab open.</Text>
          </Card>
        </div>
      )}
      {!loading && currentQuestion && preSpeakCountdown === 0 && (
        <Card className="shadow-md border border-gray-100 rounded-xl">
          <div className="relative space-y-6 p-2 md:p-4">
            <div className="text-center">
              <Title level={4} className="mb-2">Question {questionNumber} of 6</Title>
              <div className="mx-auto max-w-3xl">
                <Text className="text-lg">{currentQuestion.question}</Text>
              </div>
            </div>

            {preCountdown > 0 && (
              <div className="absolute top-2 right-3">
                <Text type="secondary">Recording starts in {preCountdown}…</Text>
              </div>
            )}

            <div className="flex items-center justify-center flex-wrap gap-3">
              <Button icon={<SoundOutlined />} disabled className="rounded-full">Question playing</Button>
              <div className={`px-4 py-1 rounded-full border ${timeRemaining <= 10 ? 'border-red-300 bg-red-50 text-red-600' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
              </div>
              <Button 
                icon={<StepForwardOutlined />}
                onClick={() => stopRecordingAndSubmit(true)}
                disabled={loading}
                className="rounded-full"
              >
                Next
              </Button>
            </div>

            <div className="flex justify-center">
              <canvas ref={canvasRef} width={600} height={120} className="w-full max-w-3xl rounded-lg border border-blue-100 bg-blue-50" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ChatInterface;