import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/RiskBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Eye, Filter, Download } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  student_id: string;
  department: string;
  semester: number;
  gender: 'male' | 'female' | 'other';
  attendance_percentage: number;
  cgpa: number;
  sgpa: number;
  fee_default: boolean;
  disciplinary_actions: number;
  scholarship: boolean;
  extracurriculars: number;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  prediction_factors: any;
  created_at: string;
}

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, riskFilter, departmentFilter]);

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

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        student =>
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Risk level filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(student => student.risk_level === riskFilter);
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(student => student.department === departmentFilter);
    }

    setFilteredStudents(filtered);
  };

  const getDepartments = () => {
    return [...new Set(students.map(student => student.department))];
  };

  const exportToCSV = () => {
    const csv = [
      // Headers
      ['Name', 'Email', 'Student ID', 'Department', 'Semester', 'Attendance %', 'CGPA', 'SGPA', 'Risk Level', 'Risk Score'].join(','),
      // Data
      ...filteredStudents.map(student => [
        student.name,
        student.email,
        student.student_id,
        student.department,
        student.semester,
        student.attendance_percentage,
        student.cgpa,
        student.sgpa,
        student.risk_level || 'N/A',
        student.risk_score ? Math.round(student.risk_score * 100) + '%' : 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getRiskExplanation = (student: Student) => {
    if (!student.risk_score || !student.prediction_factors) {
      return 'Risk analysis not available';
    }

    const factors = [];
    if (student.attendance_percentage < 75) factors.push(`low attendance (${student.attendance_percentage}%)`);
    if (student.cgpa < 6.0) factors.push(`low CGPA (${student.cgpa})`);
    if (student.fee_default) factors.push('fee default');
    if (student.disciplinary_actions > 0) factors.push(`${student.disciplinary_actions} disciplinary action(s)`);
    if (!student.scholarship && student.cgpa > 7.0) factors.push('no scholarship despite good grades');
    if (student.extracurriculars === 0) factors.push('no extracurricular activities');

    const riskPercentage = Math.round(student.risk_score * 100);
    
    return factors.length > 0
      ? `Risk: ${student.risk_level?.toUpperCase()} (${riskPercentage}%) due to ${factors.join(', ')}.`
      : `Risk: ${student.risk_level?.toUpperCase()} (${riskPercentage}%) - performing well overall.`;
  };

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground">
              Manage and monitor student dropout risk levels
            </p>
          </div>
          <Button onClick={exportToCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
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
            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>Student List</CardTitle>
            <CardDescription>
              Showing {filteredStudents.length} of {students.length} students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>CGPA</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.student_id}</TableCell>
                    <TableCell>{student.department}</TableCell>
                    <TableCell>{student.semester}</TableCell>
                    <TableCell>
                      <Badge variant={student.attendance_percentage < 75 ? "destructive" : "default"}>
                        {student.attendance_percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.cgpa < 6.0 ? "destructive" : "default"}>
                        {student.cgpa}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {student.risk_level ? (
                        <RiskBadge 
                          riskLevel={student.risk_level} 
                          riskScore={student.risk_score || undefined}
                        />
                      ) : (
                        <Badge variant="outline">Not Analyzed</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{student.name} - Profile Details</DialogTitle>
                            <DialogDescription>
                              Complete student information and risk analysis
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedStudent && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2">Basic Information</h4>
                                  <div className="space-y-2 text-sm">
                                    <p><strong>Email:</strong> {selectedStudent.email}</p>
                                    <p><strong>Student ID:</strong> {selectedStudent.student_id}</p>
                                    <p><strong>Department:</strong> {selectedStudent.department}</p>
                                    <p><strong>Semester:</strong> {selectedStudent.semester}</p>
                                    <p><strong>Gender:</strong> {selectedStudent.gender}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-semibold mb-2">Academic Performance</h4>
                                  <div className="space-y-2 text-sm">
                                    <p><strong>Attendance:</strong> {selectedStudent.attendance_percentage}%</p>
                                    <p><strong>CGPA:</strong> {selectedStudent.cgpa}</p>
                                    <p><strong>SGPA:</strong> {selectedStudent.sgpa}</p>
                                    <p><strong>Scholarship:</strong> {selectedStudent.scholarship ? 'Yes' : 'No'}</p>
                                    <p><strong>Extracurriculars:</strong> {selectedStudent.extracurriculars}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="font-semibold mb-2">Risk Factors</h4>
                                <div className="space-y-2 text-sm">
                                  <p><strong>Fee Default:</strong> {selectedStudent.fee_default ? 'Yes' : 'No'}</p>
                                  <p><strong>Disciplinary Actions:</strong> {selectedStudent.disciplinary_actions}</p>
                                </div>
                              </div>
                              
                              {selectedStudent.risk_level && (
                                <div>
                                  <h4 className="font-semibold mb-2">Risk Analysis</h4>
                                  <RiskBadge 
                                    riskLevel={selectedStudent.risk_level} 
                                    riskScore={selectedStudent.risk_score || undefined}
                                    className="mb-2"
                                  />
                                  <p className="text-sm">{getRiskExplanation(selectedStudent)}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {students.length === 0 
                  ? 'No students found. Upload student data to get started.'
                  : 'No students match your current filters.'
                }
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Students;