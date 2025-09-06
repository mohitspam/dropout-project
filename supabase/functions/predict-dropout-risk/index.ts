import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Student {
  id: string;
  attendance_percentage: number;
  cgpa: number;
  sgpa: number;
  fee_default: boolean;
  disciplinary_actions: number;
  scholarship: boolean;
  extracurriculars: number;
  semester: number;
  family_income?: number;
  distance_from_home?: number;
  hostel_accommodation: boolean;
  previous_education_gap: boolean;
}

interface PredictionResult {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  prediction_factors: {
    attendance_impact: number;
    academic_impact: number;
    financial_impact: number;
    behavioral_impact: number;
    engagement_impact: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { studentIds, processNewStudents } = await req.json();

    let students: Student[] = [];

    if (processNewStudents) {
      // Process all students without risk scores
      const { data, error } = await supabaseClient
        .from('students')
        .select('*')
        .is('risk_score', null);

      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }
      students = data || [];
    } else if (studentIds && studentIds.length > 0) {
      // Process specific students
      const { data, error } = await supabaseClient
        .from('students')
        .select('*')
        .in('id', studentIds);

      if (error) {
        console.error('Error fetching specific students:', error);
        throw error;
      }
      students = data || [];
    } else {
      return new Response(
        JSON.stringify({ error: 'No students specified for prediction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${students.length} students for risk prediction`);

    const predictions: { id: string; prediction: PredictionResult }[] = [];

    for (const student of students) {
      const prediction = predictDropoutRisk(student);
      predictions.push({ id: student.id, prediction });
    }

    // Update students with predictions in batches
    const batchSize = 50;
    let updatedCount = 0;

    for (let i = 0; i < predictions.length; i += batchSize) {
      const batch = predictions.slice(i, i + batchSize);
      
      const updates = batch.map(({ id, prediction }) => ({
        id,
        risk_score: prediction.risk_score,
        risk_level: prediction.risk_level,
        prediction_factors: prediction.prediction_factors,
      }));

      const { error } = await supabaseClient
        .from('students')
        .upsert(updates);

      if (error) {
        console.error('Error updating batch:', error);
        // Continue with other batches
      } else {
        updatedCount += batch.length;
      }
    }

    console.log(`Updated ${updatedCount} students with risk predictions`);

    return new Response(
      JSON.stringify({
        message: `Successfully processed ${updatedCount} students`,
        processedCount: updatedCount,
        totalCount: students.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Prediction error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process predictions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function predictDropoutRisk(student: Student): PredictionResult {
  // Feature weights based on educational research
  const weights = {
    attendance: 0.25,
    academic: 0.20,
    financial: 0.15,
    behavioral: 0.15,
    engagement: 0.10,
    demographics: 0.15,
  };

  // Calculate individual factor scores (0-1, where 1 is high risk)
  const attendanceRisk = calculateAttendanceRisk(student.attendance_percentage);
  const academicRisk = calculateAcademicRisk(student.cgpa, student.sgpa);
  const financialRisk = calculateFinancialRisk(student.fee_default, student.scholarship, student.family_income);
  const behavioralRisk = calculateBehavioralRisk(student.disciplinary_actions);
  const engagementRisk = calculateEngagementRisk(student.extracurriculars);
  const demographicRisk = calculateDemographicRisk(student);

  // Calculate weighted risk score
  const riskScore = 
    attendanceRisk * weights.attendance +
    academicRisk * weights.academic +
    financialRisk * weights.financial +
    behavioralRisk * weights.behavioral +
    engagementRisk * weights.engagement +
    demographicRisk * weights.demographics;

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (riskScore >= 0.7) {
    riskLevel = 'high';
  } else if (riskScore >= 0.4) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    risk_score: Math.round(riskScore * 100) / 100, // Round to 2 decimal places
    risk_level: riskLevel,
    prediction_factors: {
      attendance_impact: Math.round(attendanceRisk * 100) / 100,
      academic_impact: Math.round(academicRisk * 100) / 100,
      financial_impact: Math.round(financialRisk * 100) / 100,
      behavioral_impact: Math.round(behavioralRisk * 100) / 100,
      engagement_impact: Math.round(engagementRisk * 100) / 100,
    },
  };
}

function calculateAttendanceRisk(attendance: number): number {
  // Higher risk for lower attendance
  if (attendance >= 90) return 0.1;
  if (attendance >= 80) return 0.3;
  if (attendance >= 70) return 0.5;
  if (attendance >= 60) return 0.7;
  return 0.9;
}

function calculateAcademicRisk(cgpa: number, sgpa: number): number {
  const avgGpa = (cgpa + sgpa) / 2;
  
  // Higher risk for lower GPA
  if (avgGpa >= 8.0) return 0.1;
  if (avgGpa >= 7.0) return 0.2;
  if (avgGpa >= 6.0) return 0.4;
  if (avgGpa >= 5.0) return 0.6;
  return 0.8;
}

function calculateFinancialRisk(feeDefault: boolean, scholarship: boolean, familyIncome?: number): number {
  let risk = 0;
  
  // Fee default is a strong indicator
  if (feeDefault) risk += 0.6;
  
  // Lack of scholarship for good students might indicate financial stress
  if (!scholarship) risk += 0.2;
  
  // Family income factor (if available)
  if (familyIncome !== undefined) {
    if (familyIncome < 200000) risk += 0.3; // Low income
    else if (familyIncome < 500000) risk += 0.1; // Medium income
  }
  
  return Math.min(risk, 1.0);
}

function calculateBehavioralRisk(disciplinaryActions: number): number {
  // More disciplinary actions = higher risk
  if (disciplinaryActions === 0) return 0.1;
  if (disciplinaryActions === 1) return 0.4;
  if (disciplinaryActions === 2) return 0.6;
  return 0.8;
}

function calculateEngagementRisk(extracurriculars: number): number {
  // Lack of engagement in extracurriculars can indicate disconnection
  if (extracurriculars >= 3) return 0.1;
  if (extracurriculars >= 2) return 0.2;
  if (extracurriculars >= 1) return 0.3;
  return 0.5; // No extracurriculars
}

function calculateDemographicRisk(student: Student): number {
  let risk = 0;
  
  // Distance from home
  if (student.distance_from_home && student.distance_from_home > 500) {
    risk += 0.2;
  }
  
  // Hostel accommodation without family support
  if (student.hostel_accommodation) {
    risk += 0.1;
  }
  
  // Previous education gap
  if (student.previous_education_gap) {
    risk += 0.3;
  }
  
  // Later semester students have different risk patterns
  if (student.semester > 6) {
    risk += 0.1; // Closer to graduation, higher stakes
  }
  
  return Math.min(risk, 1.0);
}