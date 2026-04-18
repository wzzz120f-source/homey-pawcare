
The user wants two things:
1. **Build**: Add a "公益足迹" (Charity Footprint) section to the Profile page with three tabs: 我的勋章 / 我的救助 / 我的走失登记.
2. **Test**: After implementation, end-to-end test the post detail page (click post → like → top-level comment → reply with @mention → verify notifications).

Let me check ProfilePage structure briefly to plan the integration.

## Plan

### 1. Add "公益足迹" entry to ProfilePage
- Add a new card/section in `src/pages/ProfilePage.tsx` linking to `/charity-footprint` (or render inline as tabs).
- Decision: Create a dedicated page `CharityFootprintPage.tsx` at route `/charity-footprint` for clarity and code splitting, with an entry card in profile next to "我的爱心积分".

### 2. Create `src/pages/CharityFootprintPage.tsx`
Three Tabs (using existing `Tabs` component):
- **我的勋章**: Query `user_badges` where `user_id = auth.uid()`, show badge grid (icon + name + level + awarded_at). Empty state with link to community.
- **我的救助**: Query `rescue_stories` where `user_id = auth.uid()`, show cards with pet name, status, before/after thumbnails, cloud_feed_count, cloud_feed_points. Click → navigate to community guardian tab.
- **我的走失登记**: Query `lost_pets` where `user_id = auth.uid()`, show cards with pet name, status (searching/found), last_seen_location, lost_at, reward_points, clue count. Allow status toggle to "found" (UPDATE allowed by RLS).

Stats header: total badges / total rescues / total lost pets / total cloud feed points received.

### 3. Wire route in `src/App.tsx`
- Lazy import `CharityFootprintPage`, add `<Route path="/charity-footprint" element={...} />`.

### 4. End-to-end test (after build, in default mode)
After switching to default mode, use browser tools to:
1. Navigate to `/community?tab=plaza`, click first post card → assert URL `/post/:id`.
2. Click like button, verify count increments.
3. Type top-level comment "测试评论 e2e", submit.
4. Click "回复" on an existing comment from another user, type "@" → select a user from popover → add text → submit.
5. Open notification bell, verify new "有人回复了你" / "有人@了你" entries appear.
6. Also verify charity footprint page loads with three tabs.

### Files to create/edit
- **Create**: `src/pages/CharityFootprintPage.tsx`
- **Edit**: `src/App.tsx` (add route), `src/pages/ProfilePage.tsx` (add entry card)

### Notes
- No DB schema changes needed — all required tables (`user_badges`, `rescue_stories`, `lost_pets`, `lost_pet_clues`) already exist with proper RLS.
- For lost pet clue count, use a count subquery on `lost_pet_clues`.
- Reuse warm orange/cream design tokens, mobile-first, 44px touch targets, Skeleton loaders.
- Handle unauthenticated state (redirect to `/auth`).

