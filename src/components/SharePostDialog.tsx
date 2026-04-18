// Backward-compatible wrapper around the unified ShareCardDialog.
import ShareCardDialog from "./ShareCardDialog";

interface SharePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  authorName: string;
  authorAvatar?: string | null;
  contentSnippet: string;
  coverImage?: string | null;
}

const SharePostDialog = ({ postId, ...rest }: SharePostDialogProps) => (
  <ShareCardDialog kind="post" targetId={postId} {...rest} />
);

export default SharePostDialog;
