export const CLASS_EXCEL_HEADERS = ["Class Name", "Class Order"] as const;

export const SECTION_EXCEL_HEADERS = ["Class", "Class Order", "Section Name", "Capacity"] as const;

export const SUBJECT_EXCEL_HEADERS = ["Class", "Class Order", "Subject Name", "Subject Code"] as const;

export const ACADEMIC_EXCEL_RESOURCES = ["classes", "sections", "subjects"] as const;

export type AcademicExcelResource = (typeof ACADEMIC_EXCEL_RESOURCES)[number];

export function isAcademicExcelResource(key: string): key is AcademicExcelResource {
  return (ACADEMIC_EXCEL_RESOURCES as readonly string[]).includes(key);
}

export const ACADEMIC_EXCEL_SAMPLES: Record<AcademicExcelResource, Record<string, string | number>> = {
  classes: {
    "Class Name": "Class 5",
    "Class Order": 10,
  },
  sections: {
    Class: "Class 5",
    "Class Order": 10,
    "Section Name": "A",
    Capacity: 40,
  },
  subjects: {
    Class: "Class 5",
    "Class Order": 10,
    "Subject Name": "Mathematics",
    "Subject Code": "MATH",
  },
};

export const ACADEMIC_EXCEL_HEADERS: Record<AcademicExcelResource, readonly string[]> = {
  classes: CLASS_EXCEL_HEADERS,
  sections: SECTION_EXCEL_HEADERS,
  subjects: SUBJECT_EXCEL_HEADERS,
};
