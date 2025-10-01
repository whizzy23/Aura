import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Button, Upload, Input, Form, Progress, Typography, App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { 
  setCurrentCandidate, 
  setResumeData, 
  startInterview,
  setCurrentQuestion,
  setPreloadedQuestions
} from '../store/slices/interviewSlice';
import { addCandidate } from '../store/slices/candidatesSlice';
import apiService from '../services/api';
import ChatInterface from './ChatInterface';

const { Dragger } = Upload;
const { Title, Text } = Typography;

const IntervieweeTab = () => {
  const dispatch = useDispatch();
  const { message } = App.useApp();
  const { 
    currentCandidate, 
    isActive, 
    isCompleted, 
    questionNumber,
    resumeData 
  } = useSelector(state => state.interview);
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('upload'); // upload, info, interview, completed
  const [missingFields, setMissingFields] = useState([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleResumeUpload = async (file) => {
    // prevent multiple uploads while one is in progress
    if (loading) return false;
    setLoading(true);
    try {
      const result = await apiService.extractResume(file);
      
      if (result.success) {
        dispatch(setResumeData({ ...result.data, resumeText: result.resumeText || '' }));
        
        // Check for missing fields
        const missing = [];
        if (!result.data.name) missing.push('name');
        if (!result.data.email) missing.push('email');
        if (!result.data.phone) missing.push('phone');
        
        setMissingFields(missing);
        
        if (missing.length > 0) {
          setStep('info');
        } else {
          // All info available, create candidate
          const candidateData = {
            ...result.data,
            resumeText: result.resumeText || ''
          };
          dispatch(setCurrentCandidate(candidateData));
          setStep('interview');
        }
        
        message.success('Resume uploaded successfully!');
      }
    } catch (error) {
      message.error('Failed to process resume. Please try again.');
    } finally {
      setLoading(false);
    }
    
    return false; // Prevent default upload
  };

  const handleInfoSubmit = (values) => {
    const candidateData = {
      ...resumeData,
      ...values,
      resumeText: resumeData?.resumeText || ''
    };
    
    dispatch(setCurrentCandidate(candidateData));
    setStep('interview');
  };

  // Populate form values only when the info form is mounted
  useEffect(() => {
    if (step === 'info' && resumeData) {
      try { form.setFieldsValue(resumeData); } catch (_) {}
    }
  }, [step, resumeData, form]);

  const startInterviewProcess = async () => {
    let progressInterval;
    try {
      // Request mic permission before starting
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach(t => t.stop());
        } catch (e) {
          message.error('Microphone permission is required to proceed.');
          return;
        }
      }

      // Show progress bar while generating questions
      setQuestionLoading(true);
      setProgress(0);
      // Simulate progress bar animation while waiting for backend
      progressInterval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 5 : prev));
      }, 300);

      const allQ = await apiService.generateQuestions(currentCandidate);
      clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        setQuestionLoading(false);
        setProgress(0);
      }, 500);

      if (allQ?.success && Array.isArray(allQ.questions)) {
        // Only now create and add the candidate entry
        const candidateId = Date.now().toString();
        const candidateWithId = {
          ...currentCandidate,
          id: candidateId,
          status: 'in-progress',
          createdAt: new Date().toISOString()
        };
        dispatch(setCurrentCandidate(candidateWithId));
        dispatch(addCandidate(candidateWithId));

        // preload questions first
        dispatch(setPreloadedQuestions(allQ.questions));
        // now actually start interview UI
        dispatch(startInterview());
        // set first question payload with difficulty
        const first = allQ.questions.find(q => q.questionNumber === 1) || allQ.questions[0];
        if (first) dispatch(setCurrentQuestion(first));
      } else {
        // Failure without throwing (e.g., { success:false })
        message.error("We couldn’t generate your questions right now. Please try again later.");
        setStep('upload');
        dispatch({ type: 'interview/resetInterview' });
      }
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      setQuestionLoading(false);
      setProgress(0);
      message.error("We couldn’t generate your questions right now. Please try again later.");
      setStep('upload');
      dispatch({ type: 'interview/resetInterview' });
    }
  };

  const renderUploadStep = () => (
    <Card className="max-w-2xl mx-auto">
      <Title level={3} className="text-center mb-6">Upload Your Resume</Title>
      <Dragger
        accept=".pdf,.docx"
        beforeUpload={handleResumeUpload}
        showUploadList={false}
        disabled={loading}
        multiple={false}
      >
        {loading ? (
          <div className="text-center py-6">
            <div className="mb-2">
              <span className="animate-pulse inline-block w-6 h-6 rounded-full bg-blue-500" />
            </div>
            <p className="text-blue-600 font-medium">Uploading your resume…</p>
            <p className="text-gray-500 text-sm">Please wait, this may take a few seconds.</p>
          </div>
        ) : (
          <>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag resume to upload</p>
            <p className="ant-upload-hint">
              Support PDF and DOCX files only
            </p>
          </>
        )}
      </Dragger>
    </Card>
  );

  const renderInfoStep = () => (
    <Card className="max-w-2xl mx-auto">
      <Title level={3} className="text-center mb-6">Complete Your Information</Title>
      <Text className="block text-center mb-6 text-gray-600">
        We need some additional information before starting the interview
      </Text>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleInfoSubmit}
        className="space-y-4"
      >
        <Form.Item
          label="Full Name"
          name="name"
          rules={[{ required: missingFields.includes('name'), message: 'Please enter your name' }]}
        >
          <Input placeholder="Enter your full name" />
        </Form.Item>
        
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: missingFields.includes('email'), message: 'Please enter your email' },
            { type: 'email', message: 'Please enter a valid email' }
          ]}
        >
          <Input placeholder="Enter your email address" />
        </Form.Item>
        
        <Form.Item
          label="Phone Number"
          name="phone"
          rules={[{ required: missingFields.includes('phone'), message: 'Please enter your phone number' }]}
        >
          <Input placeholder="Enter your phone number" />
        </Form.Item>
        
        <Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            Start Interview
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );

  const renderInterviewStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Title level={4} className="mb-0">Interview in Progress</Title>
          <Text className="text-gray-600">Question {questionNumber} of 6</Text>
        </div>
      </div>
      
      <ChatInterface />
    </div>
  );

  const renderCompletedStep = () => (
    <Card className="max-w-2xl mx-auto text-center">
      <Title level={3} className="text-green-600 mb-4">Interview Completed!</Title>
      <Text className="block mb-6 text-gray-600">
        Thank you for completing the interview. Your responses have been recorded and will be reviewed shortly.
      </Text>
      <Button 
        type="primary" 
        onClick={() => {
          setStep('upload');
          dispatch({ type: 'interview/resetInterview' });
        }}
      >
        Start New Interview
      </Button>
    </Card>
  );

  if (isCompleted) {
    return renderCompletedStep();
  }

  if (isActive) {
    return renderInterviewStep();
  }

  if (step === 'upload') {
    return renderUploadStep();
  }

  if (step === 'info') {
    return renderInfoStep();
  }

  if (step === 'interview' && currentCandidate) {
    return (
      <Card className="max-w-2xl mx-auto text-center">
        <Title level={3} className="mb-4">Ready to Start?</Title>
        <Text className="block mb-6 text-gray-600">
          Hello {currentCandidate.name}! You're about to begin a 6-question technical interview. 
          Each question has a time limit, so be prepared to think quickly.
        </Text>
        {questionLoading ? (
          <div style={{ margin: '32px 0' }}>
            <Progress percent={progress} status={progress < 100 ? 'active' : 'success'} />
            <Text type="secondary">Generating questions, please wait…</Text>
          </div>
        ) : (
          <Button type="primary" size="large" onClick={startInterviewProcess}>
            Begin Interview
          </Button>
        )}
      </Card>
    );
  }

  return null;
};

export default IntervieweeTab;