# File Storage: Before vs After Comparison

## Scenario 1: Normal Profile Picture Update

### Before
```
User uploads new picture
├─ Delete old file: /uploads/alumni-profiles/user123-1234567890.jpg
├─ Upload new file: /uploads/alumni-profiles/user123-1234567891.jpg
└─ Update database: profilePictureUrl = /uploads/alumni-profiles/user123-1234567891.jpg
```

**Problem**: If upload fails after delete, user has NO profile picture.

### After
```
User uploads new picture
├─ Upload new file: /uploads/alumni-profiles/user123-1234567891-uuid-abc123.jpg
├─ Update database: profilePictureUrl = /uploads/alumni-profiles/user123-1234567891-uuid-abc123.jpg
└─ Delete old file: /uploads/alumni-profiles/user123-1234567890-uuid-xyz789.jpg
```

**Benefit**: User always has a picture. Old picture remains if new upload fails.

---

## Scenario 2: Upload Fails Due to Invalid File

### Before
```
User uploads WebP image
├─ Delete old file: SUCCESS
├─ Upload WebP file: REJECTED (validation error)
└─ Result: User has NO profile picture ❌
```

### After
```
User uploads WebP image
├─ Upload WebP file: REJECTED immediately (validation error)
├─ Database: UNCHANGED
└─ Result: User keeps existing profile picture ✅
```

---

## Scenario 3: Database Update Fails

### Before
```
User uploads new picture
├─ Delete old file: SUCCESS
├─ Upload new file: SUCCESS
├─ Update database: FAILED (connection timeout)
└─ Result: Orphaned file + User has no picture ❌
```

### After
```
User uploads new picture
├─ Upload new file: SUCCESS
├─ Update database: FAILED (connection timeout)
├─ Rollback: Delete newly uploaded file
└─ Result: User keeps existing profile picture ✅
```

---

## Scenario 4: Concurrent Uploads from Same User

### Before
```
Request A                          Request B
├─ Generate filename               ├─ Generate filename
│   user123-1234567890.jpg        │   user123-1234567890.jpg  ← COLLISION!
├─ Upload file (overwrites!)       └─ Upload file
└─ Database update                 └─ Database update
```

**Problem**: Files overwrite each other, corrupted uploads possible.

### After
```
Request A                                  Request B
├─ Generate filename                       ├─ Generate filename
│   user123-1234567890-uuid-abc.jpg       │   user123-1234567890-uuid-xyz.jpg  ✓ Unique!
├─ Upload file                             ├─ Upload file
├─ Database update                         ├─ Database update
└─ Delete old file                         └─ Delete old file
```

**Benefit**: Each upload gets unique filename, no overwrites.

---

## Scenario 5: File Write Interrupted

### Before
```
Upload starts
├─ Write to /uploads/alumni-profiles/user123-1234567890.jpg
├─ Process crashes mid-write
└─ Result: Corrupted partial file exists ❌
```

### After
```
Upload starts
├─ Write to /uploads/alumni-profiles/user123-1234567890-uuid-abc.jpg.tmp
├─ Process crashes mid-write
├─ Cleanup: Remove .tmp file
└─ Result: No corrupted files, old picture intact ✅
```

---

## Scenario 6: Old File Delete Fails

### Before
```
User uploads new picture
├─ Delete old file: FAILED (permissions issue)
│   Error silently swallowed
├─ Upload new file: SUCCESS
└─ Update database: SUCCESS
└─ Result: Both files exist, no error reported ⚠️
```

### After
```
User uploads new picture
├─ Upload new file: SUCCESS
├─ Update database: SUCCESS
├─ Delete old file: FAILED (permissions issue)
│   Warning logged: "Failed to delete old profile picture: EACCES"
└─ Result: User sees success, admin sees warning in logs ✅
```

**Benefit**: Operation succeeds for user, orphaned file logged for cleanup.

---

## File Naming Comparison

### Before
```
user123-1234567890.jpg
user123-1234567891.jpg
user123-1234567892.jpg
```
- Timestamp only (millisecond precision)
- Collision possible with rapid uploads
- 14 digits of randomness

### After
```
user123-1734567890123-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
user123-1734567890124-b2c3d4e5-f6a7-8901-bcde-f12345678901.jpg
user123-1734567890125-c3d4e5f6-a7b8-9012-cdef-012345678902.jpg
```
- Timestamp + UUID
- Virtually collision-proof
- 122+ bits of randomness (UUID alone)

---

## Error Messages Comparison

### Before
```
Error: Failed to upload file
```
- Generic, unhelpful

### After
```
Error: Invalid file type. Only JPEG and PNG are allowed.
Error: File size exceeds 5MB limit.
Error: Failed to save file: ENOSPC (disk full)
Error: Failed to update profile picture: Database connection timeout
```
- Specific, actionable

---

## Summary of Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Data Safety** | ❌ Can lose existing file | ✅ Always preserves existing file |
| **Collision Risk** | ⚠️ Possible with concurrent uploads | ✅ Virtually eliminated with UUID |
| **Rollback** | ❌ No cleanup on failure | ✅ Automatic cleanup |
| **Error Handling** | ❌ Silent failures | ✅ Detailed error messages |
| **Atomic Writes** | ❌ Can create partial files | ✅ Temp file + rename |
| **File Types** | ⚠️ Accepts WebP | ✅ Only JPG/PNG |
| **Production Ready** | ❌ Not safe for production | ✅ Production-ready |
