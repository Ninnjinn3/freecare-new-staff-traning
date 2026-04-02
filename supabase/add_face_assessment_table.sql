-- Create care_face_assessments table
CREATE TABLE IF NOT EXISTS public.care_face_assessments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    target_id UUID REFERENCES public.care_targets(id) ON DELETE CASCADE,
    basic_info TEXT, -- 基本情報・性格など
    medical_history TEXT, -- 既往歴・病名
    habits TEXT, -- 生活習慣・こだわり
    family_env TEXT, -- 家族構成・環境
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by TEXT -- 更新したスタッフID
);

-- Enable RLS
ALTER TABLE public.care_face_assessments ENABLE ROW LEVEL SECURITY;

-- Simple policy for now
CREATE POLICY "Allow all for authenticated" ON public.care_face_assessments
    FOR ALL USING (true);
