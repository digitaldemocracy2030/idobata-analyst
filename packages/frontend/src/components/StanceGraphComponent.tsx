import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Comment } from "../types/comment";
import type { Question } from "../types/project";

interface StanceGraphComponentProps {
  comments: Comment[];
  selectedQuestion: Question;
  showTitle?: boolean; // タイトルを表示するかどうかのオプション
}

interface StanceStats {
  count: number;
  comments: Comment[];
}

// 円グラフ用の色
export const CHART_COLORS = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#EC4899", // pink-500
  "#6366F1", // indigo-500
  "#14B8A6", // teal-500
];
export const OTHER_COLOR = "#6B7280"; // gray-500

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

export const StanceGraphComponent = ({
  comments,
  selectedQuestion,
  showTitle = true,
}: StanceGraphComponentProps) => {
  // 立場の名前を取得する関数
  const getStanceName = (stanceId: string): string => {
    if (stanceId === "other") return "その他の立場";
    if (!selectedQuestion) return "";

    const stance = selectedQuestion.stances.find((s) => s.id === stanceId);
    return stance ? stance.name : "";
  };

  // 論点と立場ごとのコメントを集計
  const calculateStanceStats = (
    question: Question,
  ): Record<string, StanceStats> => {
    const stats: Record<string, StanceStats> = {};

    // 統計オブジェクトを初期化
    for (const stance of question.stances) {
      stats[stance.id] = { count: 0, comments: [] };
    }
    // その他の立場用の初期化
    stats.other = { count: 0, comments: [] };

    for (const comment of comments) {
      const stance = comment.stances.find((s) => s.questionId === question.id);
      if (stance) {
        if (stats[stance.stanceId]) {
          stats[stance.stanceId].count++;
          stats[stance.stanceId].comments.push(comment);
        }
      }
    }

    return stats;
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
      isOther: stanceId === "other",
    }));

  return (
    <div className="space-y-6">
      {/* 選択された論点の内容 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        {showTitle && (
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {selectedQuestion.text}
          </h3>
        )}

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
                    key={`cell-${chartData[index].name}-${index}`}
                    fill={
                      chartData[index].isOther
                        ? OTHER_COLOR
                        : CHART_COLORS[index % CHART_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
