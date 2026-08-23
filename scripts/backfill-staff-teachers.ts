/**
 * Links existing Teacher records to Staff records (Staff Type = Teacher) where missing.
 * Run: npx tsx scripts/backfill-staff-teachers.ts
 */
import mongoose from "mongoose";
import { connectMongo } from "../src/lib/mongodb";
import { Staff, Teacher } from "../src/models/workspace";

async function main() {
  await connectMongo();
  const teachers = await Teacher.find({}).lean();
  let created = 0;
  let linked = 0;

  for (const teacher of teachers) {
    const workspaceId = String(teacher.workspaceId);
    if (teacher.staffId) {
      linked += 1;
      continue;
    }
    let staff = await Staff.findOne({ workspaceId, linkedTeacherId: teacher._id }).lean();
    if (!staff) {
      staff = await Staff.findOne({ workspaceId, employeeId: teacher.employeeId }).lean();
    }
    if (!staff) {
      const doc = await Staff.create({
        workspaceId: teacher.workspaceId,
        employeeId: teacher.employeeId,
        name: teacher.name,
        email: teacher.email ?? "",
        phone: teacher.phone ?? "",
        department: teacher.department ?? "Academic",
        designation: "Teacher",
        staffType: "Teacher",
        enablePortalLogin: true,
        status: teacher.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        linkedTeacherId: teacher._id,
      });
      await Teacher.findByIdAndUpdate(teacher._id, { $set: { staffId: doc._id } });
      created += 1;
    } else {
      await Staff.findByIdAndUpdate(staff._id, {
        $set: { linkedTeacherId: teacher._id, staffType: "Teacher" },
      });
      await Teacher.findByIdAndUpdate(teacher._id, { $set: { staffId: staff._id } });
      linked += 1;
    }
  }

  console.log(`Backfill complete. Created ${created} staff records, linked ${linked} existing.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
