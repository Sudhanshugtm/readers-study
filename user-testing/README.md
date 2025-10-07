# User Testing

This directory contains test scripts, results, and findings from user testing sessions for the reader feedback variants.

## Structure

```
user-testing/
├── README.md                    # This file
├── test-script.md              # Test script and instructions for participants
├── results/                    # Test results and raw data
│   ├── session-01/
│   ├── session-02/
│   └── ...
├── findings/                   # Analysis and insights
│   ├── observations.md
│   ├── metrics.md
│   └── recommendations.md
└── assets/                     # Supporting materials
    ├── consent-form.md
    └── participant-instructions.md
```

## Test Variants

1. **Option A - Suggest Topics (Stub)** - `alt-whisper-sidebar`
   - URL: https://sudhanshugtm.github.io/readers-study/variants/whisper-sidebar/
   - Description: Stub articles show "Suggest Topics" chip

2. **Option B - Quick Poll Dot** - `alt-floating-poll`
   - URL: https://sudhanshugtm.github.io/readers-study/variants/floating-poll/
   - Description: Floating poll dot appears after 10s of reading

3. **Option C - Footer Panel** - `alt-section-gap`
   - URL: https://sudhanshugtm.github.io/readers-study/variants/section-gap/
   - Description: Footer panel at 80% scroll

4. **Option D - Inline Cards** - `alt-inline-cards`
   - URL: https://sudhanshugtm.github.io/readers-study/variants/inline-cards/
   - Description: Contextual section cards for shorter sections

## Getting Started

1. Review the test script in `test-script.md`
2. Prepare testing environment
3. Conduct sessions and record results in `results/[session-name]/`
4. Document findings in `findings/`

## Notes

- All variants are mobile-responsive (768px breakpoint)
- Edit functionality is hidden on mobile devices
- Test on both desktop and mobile devices
