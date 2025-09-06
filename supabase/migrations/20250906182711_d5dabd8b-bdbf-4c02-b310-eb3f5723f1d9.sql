-- Create enum for risk levels
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');

-- Create enum for gender
CREATE TYPE public.gender AS ENUM ('male', 'female', 'other');

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  student_id TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester > 0),
  gender gender NOT NULL,
  attendance_percentage DECIMAL(5,2) NOT NULL CHECK (attendance_percentage >= 0 AND attendance_percentage <= 100),
  cgpa DECIMAL(3,2) NOT NULL CHECK (cgpa >= 0 AND cgpa <= 10),
  sgpa DECIMAL(3,2) NOT NULL CHECK (sgpa >= 0 AND sgpa <= 10),
  fee_default BOOLEAN NOT NULL DEFAULT false,
  disciplinary_actions INTEGER NOT NULL DEFAULT 0 CHECK (disciplinary_actions >= 0),
  scholarship BOOLEAN NOT NULL DEFAULT false,
  extracurriculars INTEGER NOT NULL DEFAULT 0 CHECK (extracurriculars >= 0),
  family_income DECIMAL(12,2),
  distance_from_home DECIMAL(6,2),
  hostel_accommodation BOOLEAN NOT NULL DEFAULT false,
  previous_education_gap BOOLEAN NOT NULL DEFAULT false,
  risk_score DECIMAL(3,2) CHECK (risk_score >= 0 AND risk_score <= 1),
  risk_level risk_level,
  prediction_factors JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intervention_notes table
CREATE TABLE public.intervention_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  staff_member TEXT NOT NULL,
  note TEXT NOT NULL,
  intervention_type TEXT NOT NULL,
  follow_up_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user authentication
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for students table
CREATE POLICY "Authenticated users can view all students" 
ON public.students 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert students" 
ON public.students 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update students" 
ON public.students 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete students" 
ON public.students 
FOR DELETE 
TO authenticated 
USING (true);

-- RLS policies for intervention_notes table
CREATE POLICY "Authenticated users can view all intervention notes" 
ON public.intervention_notes 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert intervention notes" 
ON public.intervention_notes 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update intervention notes" 
ON public.intervention_notes 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete intervention notes" 
ON public.intervention_notes 
FOR DELETE 
TO authenticated 
USING (true);

-- RLS policies for profiles table
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_intervention_notes_updated_at
  BEFORE UPDATE ON public.intervention_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_students_risk_level ON public.students(risk_level);
CREATE INDEX idx_students_department ON public.students(department);
CREATE INDEX idx_students_semester ON public.students(semester);
CREATE INDEX idx_students_risk_score ON public.students(risk_score);
CREATE INDEX idx_intervention_notes_student_id ON public.intervention_notes(student_id);
CREATE INDEX idx_intervention_notes_created_at ON public.intervention_notes(created_at);