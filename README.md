# CloudMap - AWS Architecture Designer with Cohere AI Assistant

CloudMap is an intelligent cloud architecture design tool that combines a visual diagram editor with an AI assistant powered by Cohere's Command model. Build, visualize, and optimize your AWS architectures with natural language interaction.

## 🚀 Key Features

- **Visual Architecture Designer**: Intuitive drag-and-drop interface for AWS architecture diagrams
- **Jarvis AI Assistant**: Intelligent assistant for architecture guidance and code generation
- **Cohere-Powered AI**: Leverages Cohere's Command-R Plus model for natural language understanding
- **CDK Generation**: Instantly generate AWS CDK code from your architecture diagrams
- **Architecture Rationale**: Get detailed cost analysis and best practices from AI
- **Multi-Layer Processing**: Advanced intent detection and context-aware responses

## 🧠 Multi-Layer AI Processing

CloudMap's Jarvis assistant uses a sophisticated multi-layer approach:

1. **Intent Detection**: Identifies the user's goal from natural language
2. **Language Detection**: Recognizes programming languages and technical contexts
3. **Context Generation**: Creates appropriate context from the architecture state
4. **Prompt Engineering**: Constructs optimized prompts based on intent
5. **AI Processing**: Processes requests through Cohere's advanced language models
6. **Post-Processing**: Enhances and structures AI responses for better UX

## 🛠️ Getting Started

### Prerequisites

- Node.js 18.x or higher
- NPM or Yarn
- Cohere API key (for Command-R Plus)

### Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/cloudmap.git
cd cloudmap
```

2. Install dependencies:
```bash
npm install
# or
yarn
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```
Edit `.env.local` and add your Cohere API key.

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open your browser and navigate to `http://localhost:9002`

## 🧩 Architecture

CloudMap consists of several key components:

- **React Flow Designer**: Interactive diagram editor
- **Jarvis AI Integration**: Natural language processing assistant
- **Cohere AI Framework**: Integration with Cohere's language models
- **CDK Code Generator**: Converts diagrams to deployable infrastructure as code

## 🤖 Using the AI Assistant

Jarvis supports a wide range of tasks:

- **Architecture Design**: "Design a scalable e-commerce architecture with Redis caching"
- **Architecture Updates**: "Add a CloudFront distribution in front of the S3 bucket"
- **CDK Generation**: "Generate CDK code for this architecture in TypeScript"
- **Cost Analysis**: "What's the estimated cost of this architecture?"
- **Security Review**: "How can I improve the security of this design?"
- **Explanations**: "Explain how the data flows between these services"

## 🔄 Cohere AI Advantages

CloudMap leverages Cohere's Command-R Plus model for several advantages:

- **Excellent Code Generation**: Superior results for AWS CDK and implementation code
- **Context Understanding**: Deep comprehension of cloud architecture concepts
- **Streaming Responses**: Real-time streaming for better user experience
- **Specialized Knowledge**: Built-in knowledge of AWS services and best practices

## 🧪 Development

### Project Structure

```
/src
  /ai            # AI integration components
    /flows       # Multi-layer processing system
    /intent      # Intent detection system
    /context     # Context management
    /prompt      # Prompt templates
    /response    # Response formatting
  /app           # Next.js app components
  /components    # React components
  /store         # State management
  /utils         # Utility functions
```

### Custom Prompts

You can customize AI behavior by modifying prompt templates in `/src/ai/prompt/promptTemplates.ts`.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- [React Flow](https://reactflow.dev/) for diagram visualization
- [Cohere](https://cohere.com/) for Command-R Plus AI model
- [AWS CDK](https://aws.amazon.com/cdk/) for infrastructure as code
