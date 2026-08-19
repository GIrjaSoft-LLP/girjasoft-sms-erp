import { AdmissionApplication, AdmissionEnquiry } from "@/models/admissions";
import { Parent, Student } from "@/models/workspace";
import { scopedQuery } from "@/lib/api/guards";

export type DuplicateMatch = {
  id: string;
  type: "ENQUIRY" | "APPLICATION" | "STUDENT" | "PARENT";
  label: string;
  studentName: string;
  parentMobile: string;
  parentEmail: string;
  aadhaar: string;
  dateOfBirth: string;
  status: string;
};

export async function findAdmissionDuplicates(
  workspaceId: string,
  input: {
    mobile?: string;
    email?: string;
    aadhaar?: string;
    studentName?: string;
    dateOfBirth?: string;
    excludeApplicationId?: string;
  },
) {
  const matches: DuplicateMatch[] = [];
  const mobile = input.mobile?.trim();
  const email = input.email?.trim().toLowerCase();
  const aadhaar = input.aadhaar?.trim();
  const studentName = input.studentName?.trim();
  const dateOfBirth = input.dateOfBirth?.trim();

  if (mobile) {
    const [enquiries, applications, parents] = await Promise.all([
      AdmissionEnquiry.find({
        ...scopedQuery(workspaceId),
        parentMobile: mobile,
      })
        .limit(5)
        .lean(),
      AdmissionApplication.find({
        ...scopedQuery(workspaceId),
        ...(input.excludeApplicationId ? { _id: { $ne: input.excludeApplicationId } } : {}),
        $or: [{ "father.mobile": mobile }, { "mother.mobile": mobile }],
      })
        .limit(5)
        .lean(),
      Parent.find({ ...scopedQuery(workspaceId), phone: mobile }).limit(5).lean(),
    ]);
    for (const row of enquiries) {
      matches.push({
        id: String(row._id),
        type: "ENQUIRY",
        label: row.enquiryNumber,
        studentName: row.studentName,
        parentMobile: row.parentMobile,
        parentEmail: row.parentEmail,
        aadhaar: "",
        dateOfBirth: row.dateOfBirth,
        status: row.status,
      });
    }
    for (const row of applications) {
      matches.push({
        id: String(row._id),
        type: "APPLICATION",
        label: row.applicationNumber,
        studentName: row.student?.name ?? "",
        parentMobile: row.father?.mobile || row.mother?.mobile || "",
        parentEmail: row.father?.email || row.mother?.email || "",
        aadhaar: row.student?.aadhaar ?? "",
        dateOfBirth: row.student?.dateOfBirth ?? "",
        status: row.status,
      });
    }
    for (const row of parents) {
      matches.push({
        id: String(row._id),
        type: "PARENT",
        label: row.name,
        studentName: "",
        parentMobile: row.phone,
        parentEmail: row.email,
        aadhaar: "",
        dateOfBirth: "",
        status: row.status,
      });
    }
  }

  if (email) {
    const applications = await AdmissionApplication.find({
      ...scopedQuery(workspaceId),
      $or: [{ "father.email": email }, { "mother.email": email }],
    })
      .limit(5)
      .lean();
    for (const row of applications) {
      matches.push({
        id: String(row._id),
        type: "APPLICATION",
        label: row.applicationNumber,
        studentName: row.student?.name ?? "",
        parentMobile: row.father?.mobile || row.mother?.mobile || "",
        parentEmail: row.father?.email || row.mother?.email || "",
        aadhaar: row.student?.aadhaar ?? "",
        dateOfBirth: row.student?.dateOfBirth ?? "",
        status: row.status,
      });
    }
  }

  if (aadhaar) {
    const applications = await AdmissionApplication.find({
      ...scopedQuery(workspaceId),
      "student.aadhaar": aadhaar,
    })
      .limit(5)
      .lean();
    for (const row of applications) {
      matches.push({
        id: String(row._id),
        type: "APPLICATION",
        label: row.applicationNumber,
        studentName: row.student?.name ?? "",
        parentMobile: row.father?.mobile || row.mother?.mobile || "",
        parentEmail: row.father?.email || row.mother?.email || "",
        aadhaar: row.student?.aadhaar ?? "",
        dateOfBirth: row.student?.dateOfBirth ?? "",
        status: row.status,
      });
    }
  }

  if (studentName && dateOfBirth) {
    const [applications, students] = await Promise.all([
      AdmissionApplication.find({
        ...scopedQuery(workspaceId),
        "student.name": studentName,
        "student.dateOfBirth": dateOfBirth,
      })
        .limit(5)
        .lean(),
      Student.find({
        ...scopedQuery(workspaceId),
        name: studentName,
        dateOfBirth,
      })
        .limit(5)
        .lean(),
    ]);
    for (const row of applications) {
      matches.push({
        id: String(row._id),
        type: "APPLICATION",
        label: row.applicationNumber,
        studentName: row.student?.name ?? "",
        parentMobile: row.father?.mobile || row.mother?.mobile || "",
        parentEmail: row.father?.email || row.mother?.email || "",
        aadhaar: row.student?.aadhaar ?? "",
        dateOfBirth: row.student?.dateOfBirth ?? "",
        status: row.status,
      });
    }
    for (const row of students) {
      matches.push({
        id: String(row._id),
        type: "STUDENT",
        label: row.admissionNumber,
        studentName: row.name,
        parentMobile: row.phone,
        parentEmail: row.email,
        aadhaar: "",
        dateOfBirth: row.dateOfBirth,
        status: row.status,
      });
    }
  }

  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.type}:${match.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
