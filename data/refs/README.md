# Character Reference Images

Upload character reference images to this directory. These images help maintain character consistency across video scenes.

## Examples
- `heroine_ref1.jpg`
- `heroine_ref2.jpg`
- `hero_ref1.jpg`
- `villain_ref1.jpg`

## Usage
Update the `reference_images` paths in `data/beats.json` to match the images you upload:

```json
"characters": [
  {
    "name": "Heroine",
    "reference_images": [
      "data/refs/heroine_ref1.jpg",
      "data/refs/heroine_ref2.jpg"
    ]
  }
]
```

## Image Guidelines
- Use high-quality images
- Show clear facial features
- Multiple angles are helpful for consistency
- JPEG or PNG format recommended
