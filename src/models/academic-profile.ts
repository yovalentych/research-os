import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/* ------------------ Schema ------------------ */

const AcademicProfileSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: 'Academic Capability Profile',
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },

    identity: {
      academicStatus: String,
      fieldOfStudy: String,
      subfields: [String],
      researchInterests: [String],
    },

    education: [
      {
        institution: String,
        faculty: String,
        department: String,
        programLevel: String,
        specialtyCode: String,
        specialization: String,
        startDate: String,
        endDate: String,
        thesisTitle: String,
        supervisor: String,
      },
    ],

    capabilities: {
      instruments: [
        {
          name: String,
          model: String,
          institution: String,
          proficiency: String,
          usedFor: [String],
        },
      ],
      methods: [
        {
          name: String,
          category: String,
          proficiency: String,
        },
      ],
      approaches: [{ name: String, description: String }],
      researchManagement: [
        {
          area: String,
          proficiency: String,
        },
      ],
      institutionalExperience: [
        {
          institution: String,
          role: String,
          context: String,
        },
      ],
    },
  },
  { timestamps: true }
);

/* ------------------ Types ------------------ */

// ✅ TypeScript тип (compile-time)
export type AcademicProfileDocument = InferSchemaType<
  typeof AcademicProfileSchema
>;

/* ------------------ Model ------------------ */

// ✅ Runtime mongoose model
export const AcademicProfile =
  mongoose.models.AcademicProfile ??
  mongoose.model('AcademicProfile', AcademicProfileSchema);
