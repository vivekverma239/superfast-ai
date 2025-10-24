import { redirect } from "next/navigation";

interface FolderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function FolderDetailPage({
  params,
}: FolderDetailPageProps) {
  const { id: folderId } = await params;

  // Redirect to the files page by default
  redirect(`/folders/${folderId}/files`);
}
