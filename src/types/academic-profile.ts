export type EducationEntry = {
  institutionId?: string;
  institutionName?: string;
  faculty?: string;
  department?: string;
  degree?: string;
  specialty?: string;
  specialization?: string;
  startYear?: number;
  endYear?: number;
};

export type InstrumentCapability = {
  name: string;
  model?: string;
  level?: 'basic' | 'intermediate' | 'advanced' | 'expert';
  institution?: string;
};

export type MethodCapability = {
  name: string;
  description?: string;
};

export type ApproachCapability = {
  name: string;
  description?: string;
};

export type ResearchManagementCapability = {
  area: string;
  description?: string;
};

export type AcademicProfile = {
  _id?: string;
  title?: string;

  education: EducationEntry[];

  capabilities: {
    instruments: InstrumentCapability[];
    methods: MethodCapability[];
    approaches: ApproachCapability[];
    researchManagement: ResearchManagementCapability[];
  };

  status?: 'draft' | 'published';
};
