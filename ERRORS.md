# Error Contract (422)

All validation/compilation errors MUST be returned as:
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable summary",
    "details": [
      {"path":"schema.path","message":"what failed"}
    ]
  }
}
```
