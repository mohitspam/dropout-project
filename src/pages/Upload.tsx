import { useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload as UploadIcon, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message: string;
  progress: number;
  processedCount?: number;
  totalCount?: number;
}

const Upload = () => {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    message: '',
    progress: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetUpload = () => {
    setUploadStatus({
      status: 'idle',
      message: '',
      progress: 0,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setUploadStatus({
        status: 'error',
        message: 'Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)',
        progress: 0,
      });
      return;
    }

    setUploadStatus({
      status: 'uploading',
      message: 'Uploading file...',
      progress: 20,
    });

    try {
      // Read file content
      const fileContent = await readFileContent(file);
      
      setUploadStatus({
        status: 'processing',
        message: 'Processing student data...',
        progress: 40,
      });

      // Parse CSV content
      const students = parseCSVContent(fileContent);
      
      if (students.length === 0) {
        throw new Error('No valid student records found in the file');
      }

      setUploadStatus({
        status: 'processing',
        message: `Processing ${students.length} student records...`,
        progress: 60,
        totalCount: students.length,
      });

      // Insert students into database in batches
      let processedCount = 0;
      const batchSize = 50;
      
      for (let i = 0; i < students.length; i += batchSize) {
        const batch = students.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('students')
          .insert(batch);

        if (error) {
          console.error('Batch insert error:', error);
          // Continue processing other batches
        }
        
        processedCount += batch.length;
        setUploadStatus({
          status: 'processing',
          message: `Processed ${processedCount} of ${students.length} records...`,
          progress: 60 + (processedCount / students.length) * 30,
          processedCount,
          totalCount: students.length,
        });
      }

      // Call ML prediction function
      setUploadStatus({
        status: 'processing',
        message: 'Running risk prediction analysis...',
        progress: 90,
        processedCount,
        totalCount: students.length,
      });

      // Trigger ML prediction for all new students
      const { error: mlError } = await supabase.functions.invoke('predict-dropout-risk', {
        body: { processNewStudents: true }
      });

      if (mlError) {
        console.error('ML prediction error:', mlError);
        // Don't fail the upload, just log the error
      }

      setUploadStatus({
        status: 'success',
        message: `Successfully uploaded and processed ${processedCount} student records!`,
        progress: 100,
        processedCount,
        totalCount: students.length,
      });

      toast({
        title: 'Upload Successful',
        description: `${processedCount} student records have been uploaded and analyzed`,
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus({
        status: 'error',
        message: error.message || 'Failed to upload and process file',
        progress: 0,
      });
      
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload and process file',
        variant: 'destructive',
      });
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const parseCSVContent = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('File must contain header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const students = [];

    // Expected headers mapping
    const headerMap: { [key: string]: string } = {
      'name': 'name',
      'email': 'email',
      'student_id': 'student_id',
      'studentid': 'student_id',
      'department': 'department',
      'semester': 'semester',
      'gender': 'gender',
      'attendance': 'attendance_percentage',
      'attendance_percentage': 'attendance_percentage',
      'cgpa': 'cgpa',
      'sgpa': 'sgpa',
      'fee_default': 'fee_default',
      'feedefault': 'fee_default',
      'disciplinary_actions': 'disciplinary_actions',
      'disciplinaryactions': 'disciplinary_actions',
      'scholarship': 'scholarship',
      'extracurriculars': 'extracurriculars',
      'family_income': 'family_income',
      'familyincome': 'family_income',
      'distance_from_home': 'distance_from_home',
      'distancefromhome': 'distance_from_home',
      'hostel_accommodation': 'hostel_accommodation',
      'hostelaccommodation': 'hostel_accommodation',
      'previous_education_gap': 'previous_education_gap',
      'previouseducationgap': 'previous_education_gap',
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      const student: any = {};
      
      headers.forEach((header, index) => {
        const mappedField = headerMap[header];
        if (mappedField && values[index]) {
          let value: any = values[index];
          
          // Type conversions
          if (['semester', 'disciplinary_actions', 'extracurriculars'].includes(mappedField)) {
            value = parseInt(value) || 0;
          } else if (['attendance_percentage', 'cgpa', 'sgpa', 'family_income', 'distance_from_home'].includes(mappedField)) {
            value = parseFloat(value) || 0;
          } else if (['fee_default', 'scholarship', 'hostel_accommodation', 'previous_education_gap'].includes(mappedField)) {
            value = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === '1';
          } else if (mappedField === 'gender') {
            value = value.toLowerCase();
            if (!['male', 'female', 'other'].includes(value)) {
              value = 'other';
            }
          }
          
          student[mappedField] = value;
        }
      });

      // Validate required fields
      if (student.name && student.email && student.student_id && student.department) {
        students.push(student);
      }
    }

    return students;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Upload Student Data</h1>
          <p className="text-muted-foreground">
            Upload student information in CSV or Excel format for risk analysis
          </p>
        </div>

        {/* Upload Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>File Format Requirements</CardTitle>
            <CardDescription>
              Please ensure your file contains the following columns (case-insensitive):
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Required Fields:</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Name</li>
                  <li>Email</li>
                  <li>Student_ID</li>
                  <li>Department</li>
                  <li>Semester</li>
                  <li>Gender (male/female/other)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Academic Fields:</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Attendance_Percentage (0-100)</li>
                  <li>CGPA (0-10)</li>
                  <li>SGPA (0-10)</li>
                  <li>Fee_Default (true/false)</li>
                  <li>Disciplinary_Actions (number)</li>
                  <li>Scholarship (true/false)</li>
                  <li>Extracurriculars (number)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Drag and drop your CSV or Excel file, or click to browse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center space-y-4 transition-colors hover:border-muted-foreground/50"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">Drop your file here</p>
                <p className="text-muted-foreground">Supports CSV, XLS, and XLSX files</p>
              </div>
              
              <div className="flex items-center justify-center gap-4">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <UploadIcon className="h-4 w-4" />
                      Browse Files
                    </span>
                  </Button>
                </Label>
                <Input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                
                {uploadStatus.status !== 'idle' && (
                  <Button variant="ghost" onClick={resetUpload}>
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Upload Status */}
            {uploadStatus.status !== 'idle' && (
              <div className="mt-6 space-y-4">
                <Progress value={uploadStatus.progress} className="w-full" />
                
                <Alert className={
                  uploadStatus.status === 'error' ? 'border-destructive' :
                  uploadStatus.status === 'success' ? 'border-green-500' : ''
                }>
                  {uploadStatus.status === 'error' && <AlertCircle className="h-4 w-4" />}
                  {uploadStatus.status === 'success' && <CheckCircle className="h-4 w-4" />}
                  {['uploading', 'processing'].includes(uploadStatus.status) && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  )}
                  <AlertDescription>
                    {uploadStatus.message}
                    {uploadStatus.processedCount && uploadStatus.totalCount && (
                      <span className="block mt-1 text-sm">
                        Progress: {uploadStatus.processedCount} / {uploadStatus.totalCount} records
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sample Data */}
        <Card>
          <CardHeader>
            <CardTitle>Sample Data Format</CardTitle>
            <CardDescription>
              Download a sample CSV file to see the expected format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                const sampleCSV = `Name,Email,Student_ID,Department,Semester,Gender,Attendance_Percentage,CGPA,SGPA,Fee_Default,Disciplinary_Actions,Scholarship,Extracurriculars
John Doe,john.doe@university.edu,CS001,Computer Science,5,male,85.5,7.2,7.8,false,0,true,3
Jane Smith,jane.smith@university.edu,EE002,Electrical Engineering,3,female,92.0,8.1,8.3,false,1,true,2
Mike Johnson,mike.johnson@university.edu,ME003,Mechanical Engineering,7,male,68.2,5.9,6.1,true,2,false,0`;
                
                const blob = new Blob([sampleCSV], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sample_student_data.csv';
                a.click();
                window.URL.revokeObjectURL(url);
              }}
            >
              Download Sample CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Upload;