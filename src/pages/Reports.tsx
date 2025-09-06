import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/RiskBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { addDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface Student {
  id: string;
  name: string;
  email: string;
  student_id: string;
  department: string;
  semester: number;
  gender: string;
  attendance_percentage: number;
  cgpa: number;
  sgpa: number;
  fee_default: boolean;
  disciplinary_actions: number;
  scholarship: boolean;
  extracurriculars: number;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  created_at: string;
}

const Reports = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, riskFilter, departmentFilter, dateRange]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch students',
        variant: 'destructive',
      });
      console.error('Fetch students error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    // Risk level filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(student => student.risk_level === riskFilter);
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(student => student.department === departmentFilter);
    }

    // Date range filter
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(student => {
        const studentDate = new Date(student.created_at);
        return studentDate >= dateRange.from! && studentDate <= dateRange.to!;
      });
    }

    setFilteredStudents(filtered);
  };

  const getDepartments = () => {
    return [...new Set(students.map(student => student.department))];
  };

  const getStatistics = () => {
    const total = filteredStudents.length;
    const highRisk = filteredStudents.filter(s => s.risk_level === 'high').length;
    const mediumRisk = filteredStudents.filter(s => s.risk_level === 'medium').length;
    const lowRisk = filteredStudents.filter(s => s.risk_level === 'low').length;
    const unanalyzed = filteredStudents.filter(s => !s.risk_level).length;
    
    const averageAttendance = total > 0 
      ? Math.round(filteredStudents.reduce((sum, s) => sum + s.attendance_percentage, 0) / total)
      : 0;
    
    const averageCGPA = total > 0
      ? Math.round((filteredStudents.reduce((sum, s) => sum + s.cgpa, 0) / total) * 100) / 100
      : 0;

    return {
      total,
      highRisk,
      mediumRisk,
      lowRisk,
      unanalyzed,
      averageAttendance,
      averageCGPA,
    };
  };

  const exportDetailedReport = () => {
    const stats = getStatistics();
    const reportData = [
      // Summary
      ['STUDENT DROPOUT RISK ANALYSIS REPORT'],
      ['Generated on:', new Date().toLocaleDateString()],
      ['Filter Period:', dateRange?.from?.toLocaleDateString() + ' to ' + dateRange?.to?.toLocaleDateString()],
      [''],
      ['SUMMARY STATISTICS'],
      ['Total Students:', stats.total],
      ['High Risk Students:', stats.highRisk],
      ['Medium Risk Students:', stats.mediumRisk],
      ['Low Risk Students:', stats.lowRisk],
      ['Unanalyzed Students:', stats.unanalyzed],
      ['Average Attendance:', stats.averageAttendance + '%'],
      ['Average CGPA:', stats.averageCGPA],
      [''],
      ['DETAILED STUDENT DATA'],
      ['Name', 'Email', 'Student ID', 'Department', 'Semester', 'Gender', 'Attendance %', 'CGPA', 'SGPA', 'Fee Default', 'Disciplinary Actions', 'Scholarship', 'Extracurriculars', 'Risk Level', 'Risk Score', 'Date Added'],
      ...filteredStudents.map(student => [
        student.name,
        student.email,
        student.student_id,
        student.department,
        student.semester,
        student.gender,
        student.attendance_percentage,
        student.cgpa,
        student.sgpa,
        student.fee_default ? 'Yes' : 'No',
        student.disciplinary_actions,
        student.scholarship ? 'Yes' : 'No',
        student.extracurriculars,
        student.risk_level || 'Not Analyzed',
        student.risk_score ? (Math.round(student.risk_score * 100) + '%') : 'N/A',
        new Date(student.created_at).toLocaleDateString(),
      ])
    ];

    const csv = reportData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_dropout_risk_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Report Exported',
      description: 'Detailed report has been downloaded successfully',
    });
  };

  const exportHighRiskReport = () => {
    const highRiskStudents = filteredStudents.filter(s => s.risk_level === 'high');
    const reportData = [
      ['HIGH RISK STUDENTS - INTERVENTION REQUIRED'],
      ['Generated on:', new Date().toLocaleDateString()],
      ['Total High Risk Students:', highRiskStudents.length],
      [''],
      ['Name', 'Email', 'Student ID', 'Department', 'Attendance %', 'CGPA', 'Risk Score', 'Key Risk Factors'],
      ...highRiskStudents.map(student => {
        const riskFactors = [];
        if (student.attendance_percentage < 75) riskFactors.push('Low Attendance');
        if (student.cgpa < 6.0) riskFactors.push('Low CGPA');
        if (student.fee_default) riskFactors.push('Fee Default');
        if (student.disciplinary_actions > 0) riskFactors.push('Disciplinary Issues');
        if (student.extracurriculars === 0) riskFactors.push('No Extracurriculars');
        
        return [
          student.name,
          student.email,
          student.student_id,
          student.department,
          student.attendance_percentage + '%',
          student.cgpa,
          student.risk_score ? (Math.round(student.risk_score * 100) + '%') : 'N/A',
          riskFactors.join('; ') || 'Other factors',
        ];
      })
    ];

    const csv = reportData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `high_risk_students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'High Risk Report Exported',
      description: 'High risk students report has been downloaded successfully',
    });
  };

  const stats = getStatistics();

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-4"></div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Generate comprehensive reports on student dropout risk analysis
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>
              Customize your report parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by risk level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {getDepartments().map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">In current filter</p>
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
                {stats.total > 0 ? Math.round((stats.highRisk / stats.total) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageAttendance}%</div>
              <p className="text-xs text-muted-foreground">Overall average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg CGPA</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageCGPA}</div>
              <p className="text-xs text-muted-foreground">Overall average</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Comprehensive Report</CardTitle>
              <CardDescription>
                Download a detailed report with all student data and risk analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Includes: Student details, risk scores, attendance, grades, and risk factors
                </div>
                <Button onClick={exportDetailedReport} className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Download Detailed Report
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>High Risk Intervention Report</CardTitle>
              <CardDescription>
                Download a focused report on students requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Includes: High-risk students with key risk factors and intervention recommendations
                </div>
                <Button 
                  onClick={exportHighRiskReport} 
                  className="w-full gap-2"
                  variant={stats.highRisk > 0 ? "default" : "outline"}
                  disabled={stats.highRisk === 0}
                >
                  <Download className="h-4 w-4" />
                  Download High Risk Report ({stats.highRisk})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Level Summary</CardTitle>
            <CardDescription>
              Breakdown of student risk levels in current filter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">High Risk</div>
                    <div className="text-2xl font-bold text-risk-high">{stats.highRisk}</div>
                  </div>
                  <RiskBadge riskLevel="high" />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Medium Risk</div>
                    <div className="text-2xl font-bold text-risk-medium">{stats.mediumRisk}</div>
                  </div>
                  <RiskBadge riskLevel="medium" />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Low Risk</div>
                    <div className="text-2xl font-bold text-risk-low">{stats.lowRisk}</div>
                  </div>
                  <RiskBadge riskLevel="low" />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Unanalyzed</div>
                    <div className="text-2xl font-bold">{stats.unanalyzed}</div>
                  </div>
                  <Badge variant="outline">Not Analyzed</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;