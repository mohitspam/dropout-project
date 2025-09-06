import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface DashboardStats {
  totalStudents: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  recentUploads: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    recentUploads: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch total students count
      const { count: totalStudents, error: totalError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Fetch risk level breakdown
      const { data: riskData, error: riskError } = await supabase
        .from('students')
        .select('risk_level');

      if (riskError) throw riskError;

      // Count risk levels
      const riskCounts = riskData?.reduce(
        (acc, student) => {
          if (student.risk_level === 'high') acc.highRisk++;
          else if (student.risk_level === 'medium') acc.mediumRisk++;
          else if (student.risk_level === 'low') acc.lowRisk++;
          return acc;
        },
        { highRisk: 0, mediumRisk: 0, lowRisk: 0 }
      ) || { highRisk: 0, mediumRisk: 0, lowRisk: 0 };

      // Fetch recent uploads (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentUploads, error: recentError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      if (recentError) throw recentError;

      setStats({
        totalStudents: totalStudents || 0,
        ...riskCounts,
        recentUploads: recentUploads || 0,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard statistics',
        variant: 'destructive',
      });
      console.error('Dashboard stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'High Risk', value: stats.highRisk, color: 'hsl(var(--risk-high))' },
    { name: 'Medium Risk', value: stats.mediumRisk, color: 'hsl(var(--risk-medium))' },
    { name: 'Low Risk', value: stats.lowRisk, color: 'hsl(var(--risk-low))' },
  ].filter(item => item.value > 0);

  const barData = [
    { name: 'Low Risk', students: stats.lowRisk, fill: 'hsl(var(--risk-low))' },
    { name: 'Medium Risk', students: stats.mediumRisk, fill: 'hsl(var(--risk-medium))' },
    { name: 'High Risk', students: stats.highRisk, fill: 'hsl(var(--risk-high))' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Student dropout risk analysis overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Students in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-risk-high" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-risk-high">{stats.highRisk}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Risk</CardTitle>
            <TrendingUp className="h-4 w-4 text-risk-medium" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-risk-medium">{stats.mediumRisk}</div>
            <p className="text-xs text-muted-foreground">
              Monitor closely
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
            <CheckCircle className="h-4 w-4 text-risk-low" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-risk-low">{stats.lowRisk}</div>
            <p className="text-xs text-muted-foreground">
              Performing well
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Breakdown of student risk levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Level Comparison</CardTitle>
            <CardDescription>Student count by risk category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="students" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Data uploads and system activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Badge variant="outline">
              {stats.recentUploads} students added in the last 7 days
            </Badge>
            {stats.totalStudents === 0 && (
              <Badge variant="outline">
                No data uploaded yet - visit Upload Data to get started
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;