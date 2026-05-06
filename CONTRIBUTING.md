# Contributing to Skill-Job-Matching-Minor

First off, thank you for considering contributing to **Skill-Job-Matching-Minor**! It's people like you that make this project such a great platform.

---

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Pledge
We are committed to providing a welcoming and inspiring community for all. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## How Can I Contribute?

There are many ways you can contribute to this project:

### 🐛 Report Bugs
If you find a bug, please report it by [opening an issue](../../issues/new?template=bug_report.md). Include:
- Clear title and description
- Exact steps to reproduce
- Expected behavior vs. actual behavior
- Screenshots (if applicable)
- Your environment (OS, Node version, etc.)

### ✨ Suggest Enhancements
Have an idea for improvement? [Open a feature request](../../issues/new?template=feature_request.md). Include:
- Clear description of the enhancement
- Use cases and benefits
- Possible implementation approach
- Additional context

### 📚 Improve Documentation
Documentation improvements are always welcome:
- Fix typos or unclear sections
- Add examples and clarifications
- Improve README or API documentation
- Add troubleshooting guides
- Translate documentation

### 🔧 Submit Code Changes

#### Getting Started with Development

**1. Fork the Repository**
```bash
# Click "Fork" on GitHub
```

**2. Clone Your Fork**
```bash
git clone https://github.com/YOUR-USERNAME/Skill-Job-Matching-Minor.git
cd Skill-Job-Matching-Minor
```

**3. Add Upstream Remote**
```bash
git remote add upstream https://github.com/original-owner/Skill-Job-Matching-Minor.git
```

**4. Create a Feature Branch**
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
# or
git checkout -b docs/documentation-update
```

**5. Install Dependencies**
```bash
cd backend
npm install

# Optional: Python ML dependencies
cd ../backend/ml
pip install -r requirements.txt
```

**6. Create `.env` File**
```bash
cd backend
# Copy and modify .env.example (if exists) or create .env
cp .env.example .env  # or create manually with required variables
```

**7. Make Your Changes**
```bash
# Edit files
# Test your changes
# Commit with clear messages
```

**8. Keep Your Fork Updated**
```bash
git fetch upstream
git rebase upstream/main
```

**9. Push to Your Fork**
```bash
git push origin feature/your-feature-name
```

**10. Open a Pull Request**
- Click "Compare & pull request" on GitHub
- Write a clear description
- Reference related issues
- Wait for review and address feedback

---

## Development Workflow

### Setting Up Your Environment

```bash
# Backend setup
cd backend
npm install
npm run dev

# In another terminal, test API
curl http://localhost:5000/api
```

### Code Style Guidelines

#### JavaScript/Node.js
```javascript
// ✅ Good: Clear variable names, proper formatting
const matchJobsToSkills = (userSkills, jobRequirements) => {
  const matches = [];
  for (const job of jobRequirements) {
    const score = calculateMatch(userSkills, job);
    if (score > 0.7) matches.push(job);
  }
  return matches;
};

// ❌ Avoid: Unclear naming, poor formatting
const m = (s, j) => { let r = []; for (let i = 0; i < j.length; i++) { if (calcM(s, j[i]) > 0.7) r.push(j[i]); } return r; };
```

#### Python
```python
# ✅ Good: PEP8 compliant
def calculate_skill_match(user_skills, job_requirements):
    """Calculate matching score between user skills and job requirements."""
    match_score = 0
    for skill in job_requirements:
        if skill in user_skills:
            match_score += 1
    return match_score / len(job_requirements) if job_requirements else 0

# ❌ Avoid: Non-standard formatting
def calc(u,j):
    s=0
    for x in j:
        if x in u:s+=1
    return s/len(j) if j else 0
```

### Commit Message Guidelines

Follow the Conventional Commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that don't affect code meaning (formatting)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Code change that improves performance
- `test:` Adding or updating tests
- `chore:` Changes to build process, dependencies, etc.

**Examples:**
```bash
# Good commits
git commit -m "feat(recommendation): add hybrid filtering algorithm"
git commit -m "fix(chatbot): handle empty message input gracefully"
git commit -m "docs(readme): add Docker setup instructions"
git commit -m "refactor(services): improve code organization"
git commit -m "test(matching): add unit tests for skill matching"
```

### Testing

```bash
cd backend

# Run all tests
npm test

# Run specific test
npm test -- test/services/job.matching.test.js

# Test with coverage
npm run test:coverage

# Test chatbot integration
npm run test:chatbot
```

### Linting & Formatting

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint:fix

# Format code
npm run format
```

---

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests locally**
   ```bash
   npm test
   npm run lint
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Test your changes manually**
   - Start the server: `npm run dev`
   - Test affected endpoints
   - Check UI if frontend changes

### PR Checklist

- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented complex sections
- [ ] I have updated documentation if needed
- [ ] My changes generate no new warnings
- [ ] I have added tests for my changes
- [ ] All tests pass locally
- [ ] Related issues are referenced

### PR Description Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Related Issue
Fixes #123

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing Done
- Tested on [platform]
- Endpoint: [describe test]
- Expected: [expected result]
- Actual: [actual result]

## Screenshots (if applicable)
[Add screenshots or GIFs]

## Checklist
- [x] Code follows style guidelines
- [x] Self-review done
- [x] Tests added/updated
- [x] Documentation updated
```

---

## Specific Contribution Areas

### 🔧 Backend Development
- Add new API endpoints
- Improve service logic
- Optimize database queries
- Add authentication/authorization
- Implement caching strategies

**Files to modify:**
- `backend/routes/`
- `backend/services/`
- `backend/models/`

### 🤖 ML Improvements
- Improve recommendation algorithms
- Add new features for ML model
- Optimize feature engineering
- Improve model accuracy
- Add model evaluation metrics

**Files to modify:**
- `backend/ml/hybrid_recommender.py`
- `backend/data/learning_pipeline/`

### 🎨 Frontend Enhancement
- Improve UI/UX
- Add new pages or features
- Optimize performance
- Improve accessibility
- Add responsive design

**Files to modify:**
- `frontend/public/`

### 📚 Documentation
- Improve README
- Add API documentation
- Create tutorials
- Add troubleshooting guides
- Improve comments in code

**Files to modify:**
- `README.md`
- `technical_blueprint.md`
- Code files with comments

### 🧪 Testing
- Add unit tests
- Add integration tests
- Add e2e tests
- Improve test coverage
- Create test utilities

**Files to add:**
- `backend/tests/`

---

## Issue Labels

When creating issues, use these labels:

- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `question` - Further information is requested
- `wontfix` - This will not be worked on

---

## Getting Help

- 📖 **Documentation** - Check [README.md](README.md) and [technical_blueprint.md](technical_blueprint.md)
- 💬 **Discussions** - Open a discussion for questions
- 📧 **Issues** - Ask in related issue threads
- 👥 **Community** - Join our community discussions

---

## Attribution

Contributors will be:
- Added to [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Recognized in release notes
- Thanked in project announcements

---

## Recognition

### Hall of Contributors

We recognize and appreciate all contributors:
- 🥇 **Major Contributors** - 10+ commits
- 🥈 **Active Contributors** - 5+ commits
- 🥉 **Dedicated Helpers** - 2+ commits
- ⭐ **First-Time Contributors** - 1 commit

---

## Resources

### Development Resources
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [JavaScript Standard](https://standardjs.com/)

### Learning Resources
- [How to Contribute to Open Source](https://opensource.guide/)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Learning Lab](https://lab.github.com/)

---

## Questions?

Don't hesitate to reach out:
- 💬 Open a [discussion](../../discussions)
- 🐛 [Create an issue](../../issues)
- 📧 Contact project maintainers

---

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

---

<div align="center">

**Thank you for contributing to Skill-Job-Matching-Minor!** 🎉

Every contribution, big or small, makes a difference.

</div>
