# Project Documentation Index

Welcome to the Prompt Optimizer project documentation! The documentation is organized into tiers and categories so that users in different roles can quickly find what they need.

## 📚 Documentation Categories

### 👥 [User Documentation](./user/)
Usage guides, deployment instructions, and FAQs for end users
- Desktop user manual
- Web usage guide
- Deployment guides (Vercel, etc.)
- Frequently asked questions

### 👨‍💻 [Developer Documentation](./developer/)
Technical documentation, API references, and troubleshooting for developers
- Technical development guide
- Project structure overview
- API documentation
- Architecture design
- Troubleshooting checklists

### 📋 [Project Management Documentation](./project/)
Requirements documents, status tracking, and planning for project management
- Product requirements document
- Project status and progress
- Version management strategy
- Feature planning

### 📦 [Development Process Archive](./archives/)
Development records archived by feature, used for tracking and debugging
- 101-singleton-refactor - Singleton pattern refactor ✅
- 102-web-architecture-refactor - Web architecture refactor ✅
- 103-desktop-architecture - Desktop architecture 🔄
- 104-test-panel-refactor - Test panel refactor 📋
- 105-output-display-v2 - Output display v2 📋
- 106-template-management - Template management feature 🔄

### 🛠️ [Development Workspace](./workspace/)
Temporary documents and development notes for the current development phase
- Development notes and scratch records
- To-do items
- Experimental designs
## 🚀 Quick Navigation

### I am a user
- Want to learn how to use it → [User Documentation](./user/)
- Need to deploy the app → [Deployment Guide](./user/deployment/)
- Running into usage problems → [Troubleshooting](./developer/troubleshooting/)

### I am a developer
- Want to contribute → [Developer Documentation](./developer/)
- Need to understand the architecture → [Technical Development Guide](./developer/technical-development-guide.md)
- Running into development problems → [Troubleshooting](./developer/troubleshooting/)
- Want to learn the history → [Development Process Archive](./archives/)

### I am a project manager
- Check project status → [Project Management Documentation](./project/)
- View feature planning → [Product Requirements Document](./project/prd.md)
- Track development progress → [Project Status](./project/project-status.md)

## 📖 Key Documents

### Core Documents
- [Project Overview](../README.md) - Project overview and quick start
- [Technical Development Guide](./developer/technical-development-guide.md) - Complete tech stack and development conventions
- [Project Structure](./developer/project-structure.md) - File and directory organization
- [Product Requirements Document](./project/prd.md) - Product feature requirements and specifications

### Specialized Documents
- [LLM Parameters Guide](./developer/llm-params-guide.md) - Detailed explanation of LLM parameter configuration
- [AI Development Workflow](./developer/ai-development-workflow.md) - Standardized workflow for AI-assisted development

## 📋 Usage Guide

### Onboarding New Members
1. Read the [Project Overview](../README.md) to understand the project at a high level
2. Review the [Project Structure](./developer/project-structure.md) to understand code organization
3. Refer to the [Technical Development Guide](./developer/technical-development-guide.md) for development conventions
4. Read the documentation categories relevant to your role

### Daily Development
1. Follow the development conventions in the [Technical Development Guide](./developer/technical-development-guide.md)
2. When you run into problems, see [Troubleshooting](./developer/troubleshooting/)
3. For historical background, see the [Development Process Archive](./archives/)

### Project Management
1. Use [Project Status](./project/project-status.md) to understand current progress
2. Read the [Product Requirements Document](./project/prd.md) to understand feature planning

## 🔄 Documentation Maintenance

### Maintenance Principles
1. **Clear categorization**: Store documents by target audience and purpose
2. **Timely updates**: Update related documents whenever code changes
3. **Regular cleanup**: Periodically remove outdated content and tidy up workspace documents
4. **Cross-references**: Establish references between related documents

### Documentation Standards
- Use Markdown format
- Use a consistent heading hierarchy
- Use syntax highlighting for code examples
- Note the update date at the end of the document

### Archiving Process
- **New feature development**: Create a new feature directory in archives/ (numbering starts at 107)
- **Important lessons**: Move them promptly from workspace/ to the corresponding feature directory in archives/
- **General guides**: Turn scratch notes into formal documents under developer/

---

**Documentation restructuring completed**: 2025-07-01
**Next cleanup plan**: Update periodically according to development progress
