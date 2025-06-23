# Testing Image Transformation API

Use these examples to test various image transformations. Replace `localhost:3237` with your actual server URL if different.

## Batch Processing

### Batch Screenshots

```bash
curl -X POST http://localhost:3237/api/batch/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example1.com",
      "https://example2.com"
    ],
    "fullPage": false,
    "width": 1920,
    "height": 1080
  }'
```

### Batch Image Transformations

```bash
curl -X POST http://localhost:3237/api/batch/images \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [
      "1744078226290.png",
      "1744078226291.png"
    ],
    "width": 800,
    "height": 600,
    "quality": 85,
    "format": "webp",
    "blur": 3,
    "borderRadius": 20,
    "grayscale": true
  }'
```

## Basic Image Retrieval

```
http://localhost:3237/api/images/screenshots/1744078226290.png //done
```

## Resize Image

```
http://localhost:3237/api/images/screenshots/1744078226290.png?width=800&height=600 //done
```

## Change Quality and Format

```
http://localhost:3237/api/images/screenshots/1744078226290.png?quality=80&format=webp
```

## Apply Effects

```
# Grayscale
http://localhost:3237/api/images/screenshots/1744078226290.png?grayscale=true //done

# Sepia
http://localhost:3237/api/images/screenshots/1744078226290.png?sepia=true //done

# Blur (value between 0.3 to 20)
http://localhost:3237/api/images/screenshots/1744078226290.png?blur=5 //done

# Negative
http://localhost:3237/api/images/screenshots/1744078226290.png?negative=true //done
```

## Advanced Transformations

```
# Add Border Radius
http://localhost:3237/api/images/screenshots/1744078226290.png?borderRadius=20 //done

# Circular Image
http://localhost:3237/api/images/screenshots/1744078226290.png?borderRadius=full //done

# Convert to Different Formats
http://localhost:3237/api/images/screenshots/1744078226290.png?format=webp
http://localhost:3237/api/images/screenshots/1744078226290.png?format=avif
http://localhost:3237/api/images/screenshots/1744078226290.png?format=png
```

## Multiple Transformations

```
# Resize + Effects
http://localhost:3237/api/images/screenshots/1744078226290.png?width=800&height=600&grayscale=true&borderRadius=20

# Format + Quality + Effects
http://localhost:3237/api/images/screenshots/1744078226290.png?format=webp&quality=85&sepia=true&blur=3 //done
```

## Convert to SVG

```
http://localhost:3237/api/images/screenshots/1744078226290.png?format=svg
```

## Image Enhancement

```
# Upscale
http://localhost:3237/api/images/screenshots/1744078226290.png?upscale=true //done

# Retouch (enhance colors and sharpness)
http://localhost:3237/api/images/screenshots/1744078226290.png?retouch=true //done
```

## Error Handling Examples

```
# Unsupported Format
http://localhost:3237/api/images/screenshots/1744078226290.bmp

# Invalid Parameters
http://localhost:3237/api/images/screenshots/1744078226290.png?quality=invalid

# Image Not Found
http://localhost:3237/api/images/screenshots/nonexistent.png
```
