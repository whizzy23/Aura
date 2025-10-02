import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Modal,
  Typography,
  Tag,
  Space,
  Rate,
} from "antd";
import {
  EyeOutlined,
  SearchOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
} from "@ant-design/icons";
import {
  setSelectedCandidate,
  clearSelectedCandidate,
} from "../store/slices/candidatesSlice";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const InterviewerTab = () => {
  const dispatch = useDispatch();
  const { candidates, selectedCandidate } = useSelector(
    (state) => state.candidates
  );

  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [filterStatus, setFilterStatus] = useState("all");

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "green";
      case "in-progress":
        return "blue";
      default:
        return "default";
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const filteredAndSortedCandidates = candidates
    .filter((candidate) => {
      const matchesSearch =
        candidate.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        candidate.email?.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus =
        filterStatus === "all" || candidate.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "score":
          return (b.finalScore || 0) - (a.finalScore || 0);
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "date":
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return 0;
      }
    });

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <div>
          <Text strong>{name || "N/A"}</Text>
          <br />
          <Text type="secondary" className="text-sm">
            {record.email || "N/A"}
          </Text>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status?.toUpperCase() || "UNKNOWN"}
        </Tag>
      ),
    },
    {
      title: "Score",
      dataIndex: "finalScore",
      key: "finalScore",
      align: "center",
      render: (score) => (
        <div className="text-center">
          {score !== null && score !== undefined ? (
            <>
              <Text className={`text-lg font-bold ${getScoreColor(score)}`}>
                {score.toFixed(2)}
              </Text>
              <br />
              <Rate disabled value={score / 2} className="text-sm" />
            </>
          ) : (
            <Text type="secondary">Pending</Text>
          )}
        </div>
      ),
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      align: "center",
      render: (date) => (
        <Text className="text-sm">{new Date(date).toLocaleDateString()}</Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      render: (_, record) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => dispatch(setSelectedCandidate(record))}
        >
          View Details
        </Button>
      ),
    },
  ];

  const renderCandidateModal = () => (
    <Modal
      title={`Candidate Details - ${selectedCandidate?.name}`}
      open={!!selectedCandidate}
      onCancel={() => dispatch(clearSelectedCandidate())}
      footer={null}
      width={800}
    >
      {selectedCandidate && (
        <div className="space-y-6">
          {/* Basic Info */}
          <Card size="small">
            <Title level={4}>Contact Information</Title>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <UserOutlined />
                <Text>{selectedCandidate.name || "N/A"}</Text>
              </div>
              <div className="flex items-center space-x-2">
                <MailOutlined />
                <Text>{selectedCandidate.email || "N/A"}</Text>
              </div>
              <div className="flex items-center space-x-2">
                <PhoneOutlined />
                <Text>{selectedCandidate.phone || "N/A"}</Text>
              </div>
            </div>
          </Card>

          {/* Interview Summary */}
          {selectedCandidate.status === "completed" && (
            <Card size="small">
              <Title level={4}>Interview Summary</Title>
              <div className="mb-4">
                <Text strong>Final Score: </Text>
                <Text
                  className={`text-xl font-bold ${getScoreColor(
                    selectedCandidate.finalScore
                  )}`}
                >
                  {selectedCandidate.finalScore?.toFixed(2)}/10
                </Text>
                <Rate
                  disabled
                  value={selectedCandidate.finalScore / 2}
                  className="ml-2"
                />
              </div>
              <Paragraph>{selectedCandidate.summary}</Paragraph>
            </Card>
          )}

          {/* Questions, Answers, Scores, and Feedback */}
          {selectedCandidate.questions && selectedCandidate.answers && (
            <Card size="small">
              <Title level={4}>Interview Details</Title>
              <div className="space-y-4">
                {selectedCandidate.questions.map((question, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <div className="mb-2 space-x-2">
                      <Text strong className="text-blue-600">
                        Question {index + 1}:
                      </Text>
                      {selectedCandidate.scores && (
                        <Tag color="blue">
                          Score: {selectedCandidate.scores[index]}/10
                        </Tag>
                      )}
                    </div>
                    <Paragraph className="mb-2">{question}</Paragraph>
                    <div className="bg-gray-50 p-3 rounded mb-2">
                      <Text strong className="text-green-600">
                        Answer:
                      </Text>
                      <Paragraph className="mt-1 mb-0">
                        {selectedCandidate.answers[index] || "No answer provided"}
                      </Paragraph>
                    </div>
                    {/* Feedback block */}
                    {selectedCandidate.feedbacks && selectedCandidate.feedbacks[index] && (
                      <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                        <Text strong className="text-yellow-700">Feedback:</Text>
                        <Paragraph className="mt-1 mb-0 text-yellow-800">
                          {selectedCandidate.feedbacks[index]}
                        </Paragraph>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Modal>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <Title level={3} className="mb-0">
              Candidate Dashboard
            </Title>
            <Text type="secondary">{candidates.length} total candidates</Text>
          </div>

          <Space wrap>
            <Input
              placeholder="Search candidates..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64"
            />

            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              className="w-32"
            >
              <Option value="all">All Status</Option>
              <Option value="completed">Completed</Option>
              <Option value="in-progress">In Progress</Option>
            </Select>

            <Select value={sortBy} onChange={setSortBy} className="w-32">
              <Option value="score">By Score</Option>
              <Option value="name">By Name</Option>
              <Option value="date">By Date</Option>
            </Select>
          </Space>
        </div>
      </Card>

      {/* Candidates Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredAndSortedCandidates}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} candidates`,
          }}
          locale={{
            emptyText: "No candidates found",
          }}
        />
      </Card>

      {/* Candidate Details Modal */}
      {renderCandidateModal()}
    </div>
  );
};

export default InterviewerTab;
