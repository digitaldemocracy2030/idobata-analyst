import { useState, useCallback, useEffect } from 'react';
import { Comment } from '../types/comment';
import { Project, Question, StanceAnalysisReport } from '../types/project';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_URL } from '../config/api';

interface StanceAnalyticsProps {
  comments: Comment[];
  project: Project;
}

interface StanceStats {
  count: number;
  comments: Comment[];
}

// 円グラフ用の色
const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
];

// カスタムツールチップ
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 shadow-lg rounded-lg border border-gray-200">
        <p className="text-sm font-medium">{payload[0].name}</p>
        <p className="text-sm text-gray-600">{payload[0].value}件</p>
      </div>
    );
  }
  return null;
};

export const StanceAnalytics = ({ comments, project }: StanceAnalyticsProps) => {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
    project.questions.length > 0 ? project.questions[0] : null
  );
  const [analysisReport, setAnalysisReport] = useState<StanceAnalysisReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [expandedStances, setExpandedStances] = useState<Record<string, boolean>>({});

  const toggleStanceExpand = (stanceId: string) => {
    setExpandedStances(prev => ({
      ...prev,
      [stanceId]: !prev[stanceId]
    }));
  };

  const fetchAnalysisReport = useCallback(async () => {
    if (!selectedQuestion) return;

    try {
      setIsLoadingReport(true);
      const response = await fetch(
        `${API_URL}/projects/${project._id}/questions/${selectedQuestion.id}/stance-analysis`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch analysis report');
      }

      const report = await response.json();
      setAnalysisReport(report);
    } catch (error) {
      console.error('Error fetching analysis report:', error);
      // TODO: エラー処理を追加
    } finally {
      setIsLoadingReport(false);
    }
  }, [project._id, selectedQuestion]);

  // 論点が変更されたら自動的に分析結果を取得
  useEffect(() => {
    if (selectedQuestion) {
      fetchAnalysisReport();
    }
  }, [selectedQuestion, fetchAnalysisReport]);

  // 論点と立場ごとのコメントを集計
  const calculateStanceStats = (question: Question): Record<string, StanceStats> => {
    const stats: Record<string, StanceStats> = {};
    
    // 統計オブジェクトを初期化
    question.stances.forEach((stance) => {
      stats[stance.id] = { count: 0, comments: [] };
    });
    // その他の立場用の初期化
    stats['other'] = { count: 0, comments: [] };
    
    comments.forEach((comment) => {
      const stance = comment.stances.find((s) => s.questionId === question.id);
      if (stance) {
        if (stats[stance.stanceId]) {
          stats[stance.stanceId].count += 1;
          stats[stance.stanceId].comments.push(comment);
        }
      }
    });

    return stats;
  };

  // 立場の名前を取得する関数
  const getStanceName = (stanceId: string): string => {
    if (stanceId === 'other') return 'その他の立場';
    if (!selectedQuestion) return '';
    
    const stance = selectedQuestion.stances.find(s => s.id === stanceId);
    return stance ? stance.name : '';
  };

  if (!selectedQuestion) {
    return <div>論点が設定されていません</div>;
  }

  const stanceStats = calculateStanceStats(selectedQuestion);

  // 円グラフ用のデータを生成
  const chartData = Object.entries(stanceStats)
    .filter(([_, stats]) => stats.count > 0)
    .map(([stanceId, stats]) => ({
      name: getStanceName(stanceId),
      value: stats.count,
    }));

  return (
    <div className="space-y-6">
      {/* 論点選択タブ */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
          {project.questions.map((question, index) => (
            <button
              key={question.id}
              onClick={() => {
                setSelectedQuestion(question);
                setAnalysisReport(null); // 論点が変更されたらレポートをリセット
              }}
              className={`
                whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm
                ${
                  selectedQuestion.id === question.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              論点 {index + 1}
            </button>
          ))}
        </nav>
      </div>

      {/* 選択された論点の内容 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {selectedQuestion.text}
        </h3>

        {/* 円グラフ */}
        <div className="h-[300px] mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={false}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* コメントリスト */}
        <div className="space-y-3 my-4">
          {Object.entries(stanceStats).map(([stanceId, stats]) => {
            if (stats.count === 0) return null;
            
            return (
              <div key={stanceId} className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-base font-medium text-gray-900">
                    {getStanceName(stanceId)}
                  </h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {stats.count}件
                  </span>
                </div>

                <div className="relative">
                  <div className="grid grid-cols-1 gap-1">
                    {stats.comments
                      .slice(0, expandedStances[stanceId] ? undefined : 3)
                      .map((comment, index) => (
                        comment.extractedContent && (
                          <div
                            key={comment._id}
                            className={`
                              bg-white px-3 py-2 text-sm border-l-4 border-blue-400
                              ${!expandedStances[stanceId] && index === 2 ? 'relative' : ''}
                            `}
                          >
                            {comment.extractedContent}
                            {!expandedStances[stanceId] && index === 2 && stats.comments.length > 3 && (
                              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
                            )}
                          </div>
                        )
                      ))}
                  </div>
                  {stats.comments.length > 3 && (
                    <div className="mt-2 text-center">
                      <button
                        onClick={() => toggleStanceExpand(stanceId)}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {!expandedStances[stanceId] ? (
                          <>
                            残り{stats.comments.length - 3}件のコメントを表示
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            コメントを折りたたむ
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* 分析レポート */}
        {isLoadingReport ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-2">
              <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm text-gray-600">分析レポートを読み込み中...</span>
            </div>
          </div>
        ) : analysisReport ? (
          <div className="mb-8 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              立場の分析レポート
            </h4>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">{analysisReport.analysis}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};