# Quick Reference: File Storage Changes

## Key Changes Summary

### 1. Filename Format Changed
**Old**: `userId-timestamp.ext`  
**New**: `userId-timestamp-uuid.ext`  
**Why**: Prevents collisions during concurrent uploads

### 2. Accepted File Types
**Removed**: WebP support  
**Allowed**: JPEG (.jpg, .jpeg) and PNG (.png) only  
**Note**: `.jpeg` files auto-normalized to `.jpg`

### 3. Upload Pattern (Critical Change)
```typescript
// OLD PATTERN (UNSAFE)
❌ Delete old file
❌ Upload new file
❌ Update database
// Problem: If upload fails, user loses picture

// NEW PATTERN (SAFE)
✅ Upload new file
✅ Update database
✅ Delete old file (with error handling)
// Benefit: User never loses data on failure
```

### 4. Error Handling
- File upload errors now provide detailed messages
- Delete errors distinguish between "not found" (ignored) vs real errors
- Rollback mechanism cleans up failed uploads

### 5. Atomic File Operations
Files are written to `.tmp` extension first, then renamed atomically to prevent corrupted partial uploads.

## Usage Example

### In Controllers
```typescript
@Put('profile')
@UseInterceptors(FileInterceptor('profilePicture'))
async updateProfile(
  @UploadedFile() file: Express.Multer.File,
  @Body() updateDto: UpdateProfileDto,
  @Request() req,
) {
  const result = await this.updateProfileUseCase.execute(
    req.user.id,
    updateDto,
    file ? {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    } : undefined
  );
  
  return result;
}
```

### Error Handling
```typescript
try {
  await updateProfile(userId, data, file);
} catch (error) {
  if (error.message.includes('Invalid file type')) {
    // Handle validation error
  } else if (error.message.includes('Failed to update profile picture')) {
    // Handle upload/DB error
  }
}
```

## Testing Checklist

- [ ] Upload JPG profile picture → Success
- [ ] Upload PNG profile picture → Success
- [ ] Upload WebP profile picture → Error (rejected)
- [ ] Upload file > 5MB → Error (rejected)
- [ ] Replace existing picture → Old file deleted
- [ ] Upload fails → Old picture remains intact
- [ ] Concurrent uploads → No collisions
- [ ] Database update fails → New file cleaned up

## Migration Notes

✅ **No database changes required**  
✅ **Existing files continue to work**  
✅ **New uploads use improved naming**  
⚠️ **Old files may remain after migration (normal)**
