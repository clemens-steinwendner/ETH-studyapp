"use client";

import Link from "next/link";
import type { Session } from "@/types/session";

interface SessionTableProps {
  sessions: Session[];
}

export function SessionTable({ sessions }: SessionTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-800">
          <th className="pb-2">Date</th>
          <th className="pb-2">Difficulty</th>
          <th className="pb-2">Questions</th>
          <th className="pb-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id} className="border-b border-gray-900 hover:bg-gray-900">
            <td className="py-2">{new Date(s.created_at).toLocaleDateString()}</td>
            <td className="py-2 capitalize">{s.difficulty}</td>
            <td className="py-2">{s.num_questions}</td>
            <td className="py-2">
              <Link href={`/session/${s.id}`} className="text-blue-400 hover:underline mr-3">View</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
