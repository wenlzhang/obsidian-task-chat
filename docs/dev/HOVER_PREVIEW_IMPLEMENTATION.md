# Hover Preview Implementation for Task Chat

## Overview

Task Chat now uses Obsidian's native hover preview system for internal links in AI responses and task descriptions. This enables seamless integration with:
- **Page Preview core plugin** - Native Obsidian hover preview (enabled by holding Cmd/Ctrl while hovering)
- **Hover Editor plugin** - Third-party plugin that enhances hover previews
- Any other plugins that hook into Obsidian's `hover-link` event system

## Problem

Previously, while internal links were clickable and worked correctly for navigation, they did not support hover preview functionality. When users held Cmd/Ctrl and hovered over links like `[[Simplify]]`, no preview appeared, unlike in the Tag Index plugin which had proper hover preview support.

## Solution

Following the Tag Index plugin's implementation pattern, we added the `enableHoverPreview()` helper method that:
1. Finds all internal links (`.internal-link` class) in rendered content
2. Adds `mouseover` event listeners to each link
3. Triggers Obsidian's `hover-link` event with proper parameters

## Implementation Details

### Changes Made

**File: `src/views/chatView.ts`**

#### 1. Added `enableHoverPreview()` Helper Method (lines 1045-1074)

```typescript
/**
 * Enable Obsidian's native hover preview for internal links
 * This works with both the core Page Preview plugin and third-party plugins like Hover Editor
 * @param containerEl - The container element containing rendered links
 * @param sourcePath - The source file path for link resolution context
 */
private enableHoverPreview(containerEl: HTMLElement, sourcePath: string): void {
    // Find all internal links (not tags or external links)
    const internalLinks = containerEl.querySelectorAll("a.internal-link");
    
    internalLinks.forEach((link) => {
        const linkEl = link as HTMLAnchorElement;
        
        // Add mouseover event listener to trigger Obsidian's hover preview
        linkEl.addEventListener("mouseover", (event: MouseEvent) => {
            // Get the link target from data-href attribute (preferred) or href
            const linktext = linkEl.getAttribute("data-href") || linkEl.getAttribute("href") || "";
            
            // Trigger Obsidian's native hover-link event
            // This enables integration with Page Preview (Cmd/Ctrl+hover) and Hover Editor plugins
            this.app.workspace.trigger("hover-link", {
                event,
                source: CHAT_VIEW_TYPE,
                hoverParent: this,
                targetEl: linkEl,
                linktext: linktext,
                sourcePath: sourcePath,
            });
        });
    });
}
```

#### 2. Enable Hover Preview for Message Content (line 519)

After `MarkdownRenderer.renderMarkdown()` renders AI response content:

```typescript
await MarkdownRenderer.renderMarkdown(
    message.content,
    contentEl,
    contextPath,
    this,
);

// Enable hover preview for internal links in message content
this.enableHoverPreview(contentEl, contextPath);
```

#### 3. Enable Hover Preview for Task Content (line 599)

After `MarkdownRenderer.renderMarkdown()` renders task descriptions:

```typescript
await MarkdownRenderer.renderMarkdown(
    taskMarkdown,
    taskContentEl,
    task.sourcePath,
    this,
);

// Enable hover preview for internal links in task content
this.enableHoverPreview(taskContentEl, task.sourcePath);
```

### How It Works

When a user hovers over an internal link in Task Chat:

1. The link has the `internal-link` class (created by `MarkdownRenderer`)
2. The link has proper attributes: `href` and `data-href` (created by `MarkdownRenderer`)
3. On `mouseover`, our event listener triggers Obsidian's `hover-link` event
4. Obsidian's hover preview system (or third-party plugins) intercepts this event
5. The preview is displayed according to user settings:
   - **Page Preview core plugin**: Hold Cmd (macOS) or Ctrl (Windows/Linux) while hovering
   - **Hover Editor plugin**: Preview appears immediately on hover (if installed and configured)

### Key Design Decisions

1. **Only internal links**: We target `.internal-link` class specifically, which excludes:
   - Tags (`.tag` class) - already handled by Obsidian's tag search
   - External links (`.external-link` class) - should open in browser, not preview

2. **Source path context**: We pass the `sourcePath` parameter to provide proper context for:
   - Message content: Uses the first recommended task's source path, or active file as fallback
   - Task content: Uses the task's own source path
   - This ensures relative links resolve correctly

3. **Following Tag Index pattern**: We use the exact same implementation pattern as the Tag Index plugin, which is known to work correctly with all preview plugins

## Benefits

- ✅ **Native integration**: Uses Obsidian's standard preview system
- ✅ **User preference**: Respects user's choice of preview method (Page Preview vs Hover Editor)
- ✅ **Plugin compatibility**: Works with Hover Editor and other preview plugins
- ✅ **Minimal code**: Clean implementation following Obsidian best practices
- ✅ **Consistent UX**: Behaves like the rest of Obsidian and other well-designed plugins

## Testing Instructions

### Testing with Page Preview Core Plugin

1. Ensure "Page Preview" core plugin is enabled in Settings → Core plugins
2. Open Task Chat sidebar
3. Send a query that returns tasks with internal links (e.g., "[[Simplify]]")
4. **Hold Cmd (macOS) or Ctrl (Windows/Linux)** and hover over an internal link
5. Verify that the preview popover appears
6. Release Cmd/Ctrl and verify preview closes

### Testing with Hover Editor Plugin

1. Install "Hover Editor" from Community Plugins (if not already installed)
2. Configure Hover Editor settings as desired
3. Open Task Chat sidebar
4. Send a query that returns tasks with internal links
5. Hover over an internal link (no need to hold Cmd/Ctrl)
6. Verify that Hover Editor's preview appears
7. Test any Hover Editor features (e.g., editing in hover)

### Testing Link Click Behavior

1. Click on any internal link in Task Chat (AI response or task description)
2. Verify the note opens in the main editor
3. Verify no errors in Developer Console (Cmd/Ctrl+Shift+I)

### Expected Behavior

**Before this fix:**
- ✅ Links were clickable and navigated correctly
- ❌ Hover preview did NOT work (no preview appeared when holding Cmd/Ctrl)
- ❌ Hover Editor did NOT work with Task Chat links

**After this fix:**
- ✅ Links are clickable and navigate correctly (unchanged)
- ✅ Hover preview works with Page Preview plugin (requires Cmd/Ctrl hold)
- ✅ Hover preview works with Hover Editor plugin (no Cmd/Ctrl needed)
- ✅ Full integration with Obsidian's preview plugin ecosystem

## Comparison with Tag Index Plugin

Our implementation follows the exact same pattern as the Tag Index plugin:

| Aspect | Tag Index | Task Chat | Status |
|--------|-----------|-----------|--------|
| Hover event trigger | ✅ `hover-link` | ✅ `hover-link` | ✅ Same |
| Parameters | ✅ event, source, hoverParent, targetEl, linktext, sourcePath | ✅ event, source, hoverParent, targetEl, linktext, sourcePath | ✅ Same |
| Target selector | ✅ `.internal-link` | ✅ `.internal-link` | ✅ Same |
| Link creation | ✅ Manual creation | ✅ `MarkdownRenderer` | ✅ Both valid |
| Source context | ✅ File path | ✅ Task source path | ✅ Both valid |

## Troubleshooting

### Preview Doesn't Appear

1. **Check if Page Preview is enabled**: Settings → Core plugins → Page Preview
2. **Verify you're holding Cmd/Ctrl**: The core plugin requires this modifier key
3. **Check Developer Console**: Look for any error messages (Cmd/Ctrl+Shift+I)
4. **Try with Hover Editor**: Install it to test without Cmd/Ctrl requirement

### Preview Appears But Doesn't Show Content

1. **Verify file exists**: Check if the linked note file is still in your vault
2. **Check file permissions**: Ensure the file is readable
3. **Reload Obsidian**: Restart Obsidian to refresh the cache

### Hover Editor Doesn't Work

1. **Verify Hover Editor is installed and enabled**: Check Community Plugins
2. **Check Hover Editor settings**: Some options may conflict
3. **Test in regular notes**: Verify Hover Editor works elsewhere in Obsidian

## Related Files

- `/src/views/chatView.ts` - Main implementation (lines 519, 599, 1045-1074)
- `/src/views/sessionModal.ts` - Session modal (unchanged)
- `@directory:../obsidian-tag-index` - Reference implementation

## References

- [Obsidian API: hover-link event](https://docs.obsidian.md/Plugins/User+interface/Views)
- [Tag Index Plugin: Hover Preview Implementation](../../../obsidian-tag-index/docs/dev/HOVER_PREVIEW_IMPLEMENTATION.md)
- [Page Preview Core Plugin](https://help.obsidian.md/Plugins/Page+preview)
- [Hover Editor Plugin](https://github.com/nothingislost/obsidian-hover-editor)

## Summary

This implementation adds native Obsidian hover preview support to Task Chat's internal links by:
1. Following the Tag Index plugin's proven pattern
2. Triggering the `hover-link` event on mouseover
3. Providing proper context via source paths
4. Supporting both Page Preview and Hover Editor plugins

The fix is minimal, clean, and fully compatible with Obsidian's plugin ecosystem.
