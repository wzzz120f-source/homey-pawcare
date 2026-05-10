import { supabase } from "@/integrations/supabase/client";

/**
 * Get or create a 1-on-1 DM conversation between current user and peer.
 * Returns the conversation id.
 */
export async function openDmConversation(currentUserId: string, peerId: string): Promise<string> {
  if (currentUserId === peerId) throw new Error("不能给自己发私信");

  // Look up existing conversation in either direction
  const { data: existing, error: findErr } = await supabase
    .from("chat_conversations")
    .select("id")
    .or(
      `and(user_id.eq.${currentUserId},peer_id.eq.${peerId}),and(user_id.eq.${peerId},peer_id.eq.${currentUserId})`,
    )
    .is("order_id", null)
    .limit(1)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  const { data: created, error: insertErr } = await supabase
    .from("chat_conversations")
    .insert({
      user_id: currentUserId,
      peer_id: peerId,
      status: "active",
      last_message: "",
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return created.id;
}
