export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listDashboardData } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";

export default async function MessagesPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }
  const data = await listDashboardData(user.id);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Recent Message Logs</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {data.rawMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada log pesan.</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Created At</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Text</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Parsed JSON</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rawMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>{new Date(message.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</TableCell>
                    <TableCell>{message.direction}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{message.message_text ?? "-"}</TableCell>
                    <TableCell>{message.processing_status}</TableCell>
                    <TableCell className="min-w-[380px] align-top">
                      <pre className="max-h-44 overflow-auto rounded bg-secondary p-2 text-xs leading-relaxed whitespace-pre-wrap break-all">
                        {message.parsed_json ? JSON.stringify(message.parsed_json, null, 2) : "-"}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
