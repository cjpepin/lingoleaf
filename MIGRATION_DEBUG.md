# Migration Debug Guide

If you're seeing migration errors during sign-in, follow these steps:

## 1. Check Enhanced Logs

After the changes, you should see detailed logs like:

```
INFO: Starting post-auth migration process { fromUserId: "...", isGuest: true }
INFO: Session established for migration { fromUserId: "...", nextId: "...", attempts: 1, sameUser: false }
INFO: Different user IDs detected, proceeding with migration
INFO: Starting user data migration
INFO: Session verified, invoking migration Edge Function
ERROR: Migration Edge Function error { error: ..., status: 401/500/etc }
```

## 2. Common Issues & Fixes

### Issue: "Same user ID after auth, no migration needed"
**Cause**: User is signing into the same account they already have  
**Action**: This is normal, no migration needed

### Issue: Error status 401
**Cause**: Edge Function not receiving auth header  
**Fix**: 
1. Check that Edge Function is deployed: `supabase functions deploy migrate-user-data`
2. Verify Supabase URL/keys are correct in env vars

### Issue: Error status 500
**Cause**: Edge Function crashed  
**Fix**: Check Supabase Dashboard → Edge Functions → Logs for stack trace

### Issue: "No fromUserId provided"
**Cause**: User wasn't a guest before signing in  
**Action**: This is normal, no migration needed

## 3. Verify Edge Function is Deployed

```bash
# In the supabase directory
cd supabase
supabase functions deploy migrate-user-data

# Check it's accessible
curl https://YOUR_PROJECT.supabase.co/functions/v1/migrate-user-data \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from_user_id":"test","to_user_id":"test"}'
```

Expected response (even with test data):
```json
{"ok":true,"migrated":false}
```

## 4. Test Migration Manually

If you want to test the migration without going through the app:

```typescript
// In a test file or console
const { data, error } = await supabase.functions.invoke('migrate-user-data', {
  body: { 
    from_user_id: 'OLD_GUEST_ID',
    to_user_id: 'NEW_USER_ID'
  }
});

console.log({ data, error });
```

## 5. Check Supabase Dashboard

1. Go to **Edge Functions** → **migrate-user-data**
2. Check **Logs** tab for recent invocations
3. Look for error messages or stack traces
4. Verify the function is showing as "Deployed"

## 6. When Migration Isn't Needed

Migration only happens when:
- User was a guest (anonymous user)
- User creates a new account OR signs into an existing account
- The new user ID is different from the guest ID

If you're just testing sign-in with the same account repeatedly, migration won't trigger.

