import { Suspense, lazy } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { ConfigProvider, Tabs, Spin, App as AntApp } from "antd";
import { store, persistor } from "./store";

// Lazy-load tab components
const IntervieweeTab = lazy(() => import("./components/IntervieweeTab"));
const InterviewerTab = lazy(() => import("./components/InterviewerTab"));

function AppContent() {
  const tabItems = [
    {
      key: "interviewee",
      label: "Interviewee",
      children: (
        <Suspense
          fallback={
            <div className="flex justify-center items-center min-h-[200px]">
              <Spin size="large" />
            </div>
          }
        >
          <IntervieweeTab />
        </Suspense>
      ),
    },
    {
      key: "interviewer",
      label: "Interviewer Dashboard",
      children: (
        <Suspense
          fallback={
            <div className="flex justify-center items-center min-h-[200px]">
              <Spin size="large" />
            </div>
          }
        >
          <InterviewerTab />
        </Suspense>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
        },
      }}
    >
      <AntApp>
        <div className="min-h-screen bg-gray-50">
          <div className="pl-8 pt-8">
            <img
              src="/logo.webp"
              alt="AI Interview Assistant"
              className="h-12"
              loading="eager"
            />
          </div>

          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-center text-gray-800">
              AI-Powered Interview Assistant
            </h1>

            <Tabs
              defaultActiveKey="interviewee"
              centered
              size="large"
              items={tabItems}
            />
          </div>
        </div>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<Spin size="large" />} persistor={persistor}>
        <AppContent />
      </PersistGate>
    </Provider>
  );
}

export default App;
