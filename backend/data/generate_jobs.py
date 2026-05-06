import json
import random

# Read existing jobs
with open('merged_jobs_dataset.json', 'r', encoding='utf-8') as f:
    existing_jobs = json.load(f)

existing_titles = {job['title'].lower() for job in existing_jobs}
existing_skills = set()
for job in existing_jobs:
    existing_skills.update([s.lower() for s in job.get('skillsRequired', [])])

# New job categories and variations
job_prefixes = ['Senior', 'Junior', 'Lead', 'Principal', 'Staff', 'Associate', 'Chief', 'Head of', 'VP of', 'Director of']
job_roles = [
    'Quantum Computing Engineer', 'Blockchain Architect', 'Edge Computing Specialist', 
    'AR/VR Developer', 'Computer Vision Engineer', 'NLP Engineer', 'Robotics Engineer',
    'Bioinformatics Analyst', 'Fintech Developer', 'Gaming Backend Engineer',
    '5G Network Engineer', 'Autonomous Vehicle Developer', 'Smart Contract Developer',
    'MLOps Engineer', 'DataOps Engineer', 'AIOps Engineer', 'Chatbot Developer',
    'Voice UI Developer', 'Wearable Tech Developer', 'Smart Home Engineer',
    'Drone Software Engineer', 'Satellite Systems Engineer', 'Cybersecurity Architect',
    'Privacy Engineer', 'Compliance Engineer', 'Risk Management Analyst',
    'Penetration Testing Lead', 'SOC Analyst', 'Threat Intelligence Analyst',
    'Incident Response Manager', 'Digital Forensics Expert', 'SCADA Engineer',
    'Industrial IoT Engineer', 'Supply Chain Analyst', 'Logistics Engineer',
    'E-Learning Platform Developer', 'Healthcare IT Specialist', 'Telemedicine Engineer',
    'Genomics Data Scientist', 'Climate Tech Engineer', 'Sustainability Analyst',
    'Renewable Energy Systems Engineer', 'Smart Grid Engineer', 'Agricultural Tech Developer',
    'Food Tech Engineer', 'Fashion Tech Developer', 'Sports Analytics Engineer',
    'Esports Platform Engineer', 'Streaming Platform Engineer', 'Content Delivery Engineer',
    'Social Media Analytics Engineer', 'Recommendation Systems Engineer', 'Search Engineer',
    'Conversational AI Engineer', 'Synthetic Data Engineer', 'Data Privacy Officer',
    'Ethical AI Specialist', 'Explainable AI Engineer', 'Federated Learning Engineer',
    'Graph Database Engineer', 'Time Series Analyst', 'Real-Time Analytics Engineer',
    'Stream Processing Engineer', 'Event-Driven Architect', 'Microservices Architect',
    'Serverless Architect', 'Multi-Cloud Architect', 'Hybrid Cloud Engineer',
    'Cloud Cost Optimization Engineer', 'Cloud Migration Specialist', 'Platform Engineer',
    'Site Reliability Engineer', 'Observability Engineer', 'Chaos Engineer',
    'Performance Engineer', 'Capacity Planning Engineer', 'Infrastructure Automation Engineer',
    'Configuration Management Specialist', 'Secret Management Engineer', 'API Gateway Engineer',
    'Service Mesh Engineer', 'Container Security Engineer', 'Kubernetes Platform Engineer',
    'OpenShift Developer', 'Cloud Native Developer', 'WebAssembly Engineer',
    'Progressive Web App Developer', 'Mobile Backend Developer', 'Cross-Platform Developer',
    'Flutter Developer', 'React Native Developer', 'Ionic Developer',
    'Xamarin Developer', 'Unity Game Developer', 'Unreal Engine Developer',
    'Game Physics Engineer', 'Graphics Programmer', '3D Modeling Engineer',
    'Animation Systems Engineer', 'Audio Engineer', 'Multiplayer Systems Engineer',
    'Game AI Programmer', 'Localization Engineer', 'Payment Systems Engineer',
    'Fraud Detection Engineer', 'Risk Analytics Engineer', 'Trading Systems Developer',
    'High-Frequency Trading Engineer', 'Algorithmic Trading Developer', 'Market Data Engineer',
    'Compliance Automation Engineer', 'RegTech Developer', 'InsurTech Engineer',
    'Credit Risk Analyst', 'Anti-Money Laundering Analyst', 'KYC Engineer',
    'Digital Banking Engineer', 'Cryptocurrency Developer', 'DeFi Developer',
    'NFT Platform Engineer', 'Web3 Developer', 'DAO Engineer',
    'Metaverse Developer', 'Digital Twin Engineer', 'Simulation Engineer',
    'Virtual Production Engineer', 'Motion Capture Engineer', 'Haptic Technology Engineer',
    'Gesture Recognition Engineer', 'Eye Tracking Developer', 'Brain-Computer Interface Engineer',
    'Accessibility Engineer', 'Internationalization Engineer', 'Localization Architect',
    'Technical Documentation Engineer', 'Developer Advocate', 'Solution Architect',
    'Enterprise Architect', 'Integration Architect', 'Middleware Engineer',
    'ETL Developer', 'Data Pipeline Engineer', 'Data Mesh Architect',
    'Data Fabric Engineer', 'Master Data Management Specialist', 'Data Catalog Engineer',
    'Metadata Management Engineer', 'Data Lineage Engineer', 'Data Quality Engineer',
    'Synthetic Data Generator', 'Data Anonymization Engineer', 'GDPR Compliance Engineer',
    'CCPA Compliance Engineer', 'Privacy Tech Engineer', 'Identity Management Engineer',
    'Zero Trust Architect', 'Passwordless Authentication Engineer', 'Biometric Systems Engineer',
    'Multi-Factor Authentication Engineer', 'Certificate Management Engineer', 'PKI Engineer'
]

# Expanded skills pool (700+ unique skills)
skills_pool = [
    # Programming Languages (50+)
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift',
    'Ruby', 'PHP', 'Scala', 'R', 'Julia', 'Dart', 'Elixir', 'Erlang', 'Haskell', 'Clojure',
    'F#', 'Lua', 'Perl', 'Groovy', 'Objective-C', 'COBOL', 'Fortran', 'Assembly', 'VHDL', 'Verilog',
    'Solidity', 'Vyper', 'Move', 'Cairo', 'Noir', 'WebAssembly', 'SQL', 'PL/SQL', 'T-SQL', 'GraphQL',
    'MATLAB', 'LabVIEW', 'Scratch', 'Bash', 'PowerShell', 'Shell Scripting', 'AWK', 'SED', 'TCL', 'Lisp',
    
    # Web Technologies (60+)
    'HTML5', 'CSS3', 'SASS', 'LESS', 'React', 'Angular', 'Vue.js', 'Svelte', 'Next.js', 'Nuxt.js',
    'Gatsby', 'Remix', 'SolidJS', 'Qwik', 'Astro', 'jQuery', 'Bootstrap', 'Tailwind CSS', 'Material-UI', 'Chakra UI',
    'Node.js', 'Express.js', 'Nest.js', 'Fastify', 'Koa', 'Hapi', 'Django', 'Flask', 'FastAPI', 'Tornado',
    'Spring Boot', 'Spring Framework', 'Quarkus', 'Micronaut', 'ASP.NET Core', 'Ruby on Rails', 'Laravel', 'Symfony', 'CodeIgniter', 'Yii',
    'Phoenix', 'Gin', 'Echo', 'Fiber', 'Actix', 'Rocket', 'Axum', 'GraphQL', 'Apollo', 'Relay',
    'tRPC', 'Prisma', 'TypeORM', 'Sequelize', 'Mongoose', 'Hibernate', 'JPA', 'MyBatis', 'ActiveRecord', 'Ecto',
    
    # Cloud & DevOps (80+)
    'AWS', 'Azure', 'GCP', 'IBM Cloud', 'Oracle Cloud', 'Alibaba Cloud', 'DigitalOcean', 'Linode', 'Vultr', 'Heroku',
    'Docker', 'Kubernetes', 'OpenShift', 'Rancher', 'Nomad', 'Podman', 'Containerd', 'CRI-O', 'LXC', 'LXD',
    'Terraform', 'Pulumi', 'CloudFormation', 'ARM Templates', 'Ansible', 'Chef', 'Puppet', 'SaltStack', 'Packer', 'Vagrant',
    'Jenkins', 'GitLab CI', 'GitHub Actions', 'CircleCI', 'Travis CI', 'Bamboo', 'TeamCity', 'Azure DevOps', 'ArgoCD', 'Flux',
    'Helm', 'Kustomize', 'Skaffold', 'Tilt', 'Okteto', 'Garden', 'Prometheus', 'Grafana', 'Datadog', 'New Relic',
    'Splunk', 'ELK Stack', 'Loki', 'Tempo', 'Jaeger', 'Zipkin', 'OpenTelemetry', 'Istio', 'Linkerd', 'Consul',
    'Envoy', 'Traefik', 'NGINX', 'HAProxy', 'Kong', 'Apache', 'Caddy', 'Vault', 'Sealed Secrets', 'SOPS',
    'ArgoCD', 'Spinnaker', 'CloudBees', 'Octopus Deploy', 'AWS CodeDeploy', 'Azure Pipelines', 'Buildkite', 'Drone', 'Concourse', 'Tekton',
    
    # Databases (60+)
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'DynamoDB', 'CouchDB', 'Neo4j', 'ArangoDB',
    'InfluxDB', 'TimescaleDB', 'ClickHouse', 'Druid', 'Pinot', 'RocksDB', 'LevelDB', 'SQLite', 'Oracle DB', 'SQL Server',
    'MariaDB', 'Percona', 'CockroachDB', 'YugabyteDB', 'TiDB', 'Vitess', 'FaunaDB', 'Supabase', 'Firebase', 'Firestore',
    'Memcached', 'Hazelcast', 'Ignite', 'GemFire', 'Aerospike', 'Couchbase', 'RavenDB', 'OrientDB', 'JanusGraph', 'Dgraph',
    'TigerGraph', 'Amazon Neptune', 'Azure Cosmos DB', 'Google Bigtable', 'Apache HBase', 'Apache Phoenix', 'Accumulo', 'Riak', 'VoltDB', 'MemSQL',
    'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'Azure Synapse', 'Teradata', 'Vertica', 'Greenplum', 'Presto', 'Trino',
    
    # AI/ML/Data Science (80+)
    'TensorFlow', 'PyTorch', 'Keras', 'JAX', 'Scikit-learn', 'XGBoost', 'LightGBM', 'CatBoost', 'ONNX', 'TensorRT',
    'OpenCV', 'YOLO', 'Mask R-CNN', 'ResNet', 'BERT', 'GPT', 'Transformer', 'Stable Diffusion', 'Hugging Face', 'LangChain',
    'Pandas', 'NumPy', 'SciPy', 'Matplotlib', 'Seaborn', 'Plotly', 'Bokeh', 'Altair', 'D3.js', 'Chart.js',
    'Apache Spark', 'PySpark', 'Hadoop', 'Hive', 'Pig', 'Airflow', 'Prefect', 'Dagster', 'Kedro', 'MLflow',
    'Kubeflow', 'Seldon', 'BentoML', 'Ray', 'Dask', 'Polars', 'DuckDB', 'Apache Flink', 'Storm', 'Samza',
    'Kafka Streams', 'KSQL', 'Debezium', 'NiFi', 'StreamSets', 'Talend', 'Informatica', 'dbt', 'Great Expectations', 'Pandera',
    'Feature Store', 'Feast', 'Tecton', 'AutoML', 'H2O.ai', 'TPOT', 'Auto-sklearn', 'Neural Architecture Search', 'Optuna', 'Hyperopt',
    'Weights & Biases', 'Neptune.ai', 'Comet.ml', 'ClearML', 'Sacred', 'DVC', 'Label Studio', 'Prodigy', 'Snorkel', 'Weak Supervision',
    
    # Security (60+)
    'OWASP', 'Penetration Testing', 'Ethical Hacking', 'Vulnerability Assessment', 'Security Auditing', 'Threat Modeling', 'Risk Assessment', 'SIEM', 'SOAR', 'XDR',
    'Burp Suite', 'Metasploit', 'Nmap', 'Wireshark', 'Snort', 'Suricata', 'OSSEC', 'Wazuh', 'Falco', 'Sysdig',
    'AppArmor', 'SELinux', 'Seccomp', 'Firewalld', 'iptables', 'nftables', 'pfSense', 'OPNsense', 'Cisco ASA', 'Fortinet',
    'Palo Alto', 'Check Point', 'CrowdStrike', 'SentinelOne', 'Carbon Black', 'Symantec', 'McAfee', 'Trend Micro', 'Kaspersky', 'Bitdefender',
    'OAuth 2.0', 'OpenID Connect', 'SAML', 'JWT', 'Kerberos', 'LDAP', 'Active Directory', 'Azure AD', 'Okta', 'Auth0',
    'SSL/TLS', 'PKI', 'Certificate Authority', 'HashiCorp Vault', 'AWS Secrets Manager', 'Azure Key Vault', 'KMS', 'HSM', 'TPM', 'Secure Boot',
    
    # Mobile Development (40+)
    'iOS Development', 'Android Development', 'React Native', 'Flutter', 'Xamarin', 'Ionic', 'Cordova', 'Capacitor', 'NativeScript', 'Kotlin Multiplatform',
    'SwiftUI', 'UIKit', 'Jetpack Compose', 'Android SDK', 'Core Data', 'Realm', 'SQLite', 'Room', 'Firebase', 'Parse',
    'Push Notifications', 'In-App Purchases', 'App Store Optimization', 'TestFlight', 'Google Play Console', 'Fastlane', 'Bitrise', 'CodeMagic', 'App Center', 'BrowserStack',
    'XCTest', 'XCUITest', 'Espresso', 'UIAutomator', 'Appium', 'Detox', 'Maestro', 'ARKit', 'ARCore', 'CoreML',
    
    # Emerging Technologies (60+)
    'Blockchain', 'Smart Contracts', 'Ethereum', 'Solana', 'Polygon', 'Binance Smart Chain', 'Cardano', 'Polkadot', 'Avalanche', 'Cosmos',
    'Web3.js', 'Ethers.js', 'Hardhat', 'Truffle', 'Remix', 'OpenZeppelin', 'Chainlink', 'The Graph', 'IPFS', 'Filecoin',
    'Quantum Computing', 'Qiskit', 'Cirq', 'Q#', 'Quantum Algorithms', 'Edge Computing', 'IoT', 'MQTT', 'CoAP', 'LoRaWAN',
    'Zigbee', 'Z-Wave', 'Thread', 'Matter', 'Arduino', 'Raspberry Pi', 'ESP32', 'Embedded Systems', 'RTOS', 'FreeRTOS',
    'Zephyr', 'Mbed', 'AUTOSAR', 'CAN Bus', 'LIN Bus', 'OBD-II', 'ROS', 'ROS2', 'Gazebo', 'SLAM',
    'Computer Vision', 'LiDAR', 'Radar', 'Sensor Fusion', 'Kalman Filter', 'Particle Filter', 'Path Planning', 'Motion Control', 'PID Control', 'Model Predictive Control',
    
    # Testing & Quality (50+)
    'Unit Testing', 'Integration Testing', 'E2E Testing', 'Performance Testing', 'Load Testing', 'Stress Testing', 'Security Testing', 'Accessibility Testing', 'Usability Testing', 'A/B Testing',
    'Jest', 'Mocha', 'Chai', 'Jasmine', 'Karma', 'Pytest', 'unittest', 'JUnit', 'TestNG', 'NUnit',
    'Selenium', 'Cypress', 'Playwright', 'Puppeteer', 'WebDriverIO', 'TestCafe', 'Robot Framework', 'Cucumber', 'SpecFlow', 'Behave',
    'JMeter', 'Gatling', 'K6', 'Locust', 'Artillery', 'Apache Bench', 'Vegeta', 'wrk', 'Postman', 'Insomnia',
    'SonarQube', 'CodeClimate', 'Coveralls', 'Codecov', 'ESLint', 'Prettier', 'Black', 'Pylint', 'Flake8', 'mypy',
    
    # Design & UX (40+)
    'UI/UX Design', 'Figma', 'Sketch', 'Adobe XD', 'InVision', 'Zeplin', 'Abstract', 'Framer', 'Principle', 'ProtoPie',
    'User Research', 'Usability Testing', 'User Interviews', 'Persona Development', 'User Journey Mapping', 'Information Architecture', 'Wireframing', 'Prototyping', 'Visual Design', 'Interaction Design',
    'Design Systems', 'Atomic Design', 'Design Tokens', 'Storybook', 'Chromatic', 'Responsive Design', 'Mobile-First Design', 'Accessibility', 'WCAG', 'ARIA',
    'Color Theory', 'Typography', 'Grid Systems', 'White Space', 'Gestalt Principles', 'Design Thinking', 'Lean UX', 'Agile UX', 'Service Design', 'Design Sprint',
    
    # Networking (50+)
    'TCP/IP', 'HTTP/HTTPS', 'DNS', 'DHCP', 'VPN', 'SD-WAN', 'BGP', 'OSPF', 'MPLS', 'VLAN',
    'QoS', 'Load Balancing', 'CDN', 'CloudFlare', 'Akamai', 'Fastly', 'Route 53', 'Azure Traffic Manager', 'F5', 'NetScaler',
    'Cisco IOS', 'Juniper Junos', 'Arista EOS', 'Mikrotik', 'Ubiquiti', 'pfSense', 'VyOS', 'FRRouting', 'BIRD', 'GoBGP',
    'WireGuard', 'OpenVPN', 'IPSec', 'L2TP', 'PPTP', 'SSH', 'Telnet', 'SNMP', 'NetFlow', 'sFlow',
    'Network Monitoring', 'Nagios', 'Zabbix', 'PRTG', 'LibreNMS', 'Observium', 'Cacti', 'Smokeping', 'MTR', 'Traceroute',
    
    # Other Essential Skills (50+)
    'Agile', 'Scrum', 'Kanban', 'SAFe', 'Lean', 'DevOps Culture', 'SRE Principles', 'Incident Management', 'Change Management', 'Problem Management',
    'ITIL', 'COBIT', 'ISO 27001', 'SOC 2', 'HIPAA', 'GDPR', 'CCPA', 'PCI DSS', 'NIST', 'CIS Controls',
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Mercurial', 'SVN', 'Perforce', 'Code Review', 'Pull Requests', 'Merge Strategies',
    'Technical Writing', 'Documentation', 'API Documentation', 'Swagger', 'OpenAPI', 'AsyncAPI', 'Confluence', 'Notion', 'ReadTheDocs', 'Docusaurus',
    'Project Management', 'Jira', 'Trello', 'Asana', 'Monday.com', 'Linear', 'ClickUp', 'Basecamp', 'Microsoft Project', 'Smartsheet'
]

# Certifications pool
certifications_pool = [
    'AWS Certified Solutions Architect', 'AWS Certified Developer', 'AWS Certified DevOps Engineer', 'AWS Certified Security Specialty',
    'AWS Certified Machine Learning', 'Azure Solutions Architect', 'Azure Developer Associate', 'Azure Administrator', 'Azure Security Engineer',
    'Azure AI Engineer', 'Google Cloud Professional Architect', 'Google Cloud Professional Developer', 'Google Cloud Professional Data Engineer',
    'Certified Kubernetes Administrator (CKA)', 'Certified Kubernetes Application Developer (CKAD)', 'Certified Kubernetes Security Specialist (CKS)',
    'Red Hat Certified Engineer (RHCE)', 'Red Hat Certified Specialist in Ansible', 'CompTIA Security+', 'CompTIA Network+',
    'CISSP', 'CEH - Certified Ethical Hacker', 'OSCP', 'CISM', 'CISA', 'CRISC',
    'PMP - Project Management Professional', 'CSM - Certified Scrum Master', 'CSPO - Certified Scrum Product Owner',
    'Terraform Associate', 'Docker Certified Associate', 'MongoDB Certified Developer', 'Oracle Certified Professional',
    'Microsoft Certified: Azure Data Scientist Associate', 'TensorFlow Developer Certificate', 'Cloudera Certified Professional',
    'Salesforce Certified Developer', 'ServiceNow Certified Administrator', 'Cisco CCNA', 'Cisco CCNP',
    'ITIL Foundation', 'TOGAF Certified', 'SAFe Agilist', 'Six Sigma Black Belt'
]

# Generate job descriptions
descriptions = [
    "Design, develop, and maintain cutting-edge {} solutions. Work with cross-functional teams to deliver high-quality products.",
    "Lead the development and implementation of {} systems. Mentor team members and drive technical excellence.",
    "Build and optimize {} infrastructure. Ensure scalability, reliability, and security of production systems.",
    "Architect and deploy {} solutions at scale. Collaborate with stakeholders to define technical strategy.",
    "Develop innovative {} applications. Write clean, maintainable code and follow best practices.",
    "Manage {} projects from conception to deployment. Coordinate with multiple teams and ensure timely delivery.",
    "Implement {} best practices and automation. Improve development workflows and system efficiency.",
    "Research and apply {} technologies. Stay current with industry trends and emerging tools.",
    "Secure and monitor {} environments. Identify vulnerabilities and implement protective measures.",
    "Analyze data and build {} models. Transform business requirements into technical solutions."
]

experience_levels = ['Entry Level', 'Mid Level', 'Senior Level', 'Expert']
salary_ranges = {
    'Entry Level': '$45,000 - $70,000',
    'Mid Level': '$70,000 - $110,000',
    'Senior Level': '$110,000 - $160,000',
    'Expert': '$160,000 - $230,000'
}

new_jobs = []
jobs_needed = 144  # To reach 500 from 356

# Ensure we have enough diverse skills (targeting 700+)
# We already have 693, need at least 7+ more unique skills
additional_skills = [
    'Low-Code Development', 'No-Code Platforms', 'Citizen Development', 'RPA - Robotic Process Automation',
    'UiPath', 'Blue Prism', 'Automation Anywhere', 'Power Automate', 'Zapier', 'IFTTT',
    'Vector Databases', 'Pinecone', 'Weaviate', 'Milvus', 'Chroma', 'Qdrant',
    'LLM Fine-tuning', 'Prompt Engineering', 'RAG - Retrieval Augmented Generation', 'Semantic Search',
    'Function Calling', 'Agent Development', 'AutoGPT', 'LangSmith', 'LlamaIndex'
]

skills_pool.extend(additional_skills)

for i in range(jobs_needed):
    # Create unique job title
    if i < 70:
        # Add prefix variations
        prefix = random.choice(job_prefixes) if random.random() > 0.3 else ''
        role = random.choice(job_roles)
        title = f"{prefix} {role}".strip() if prefix else role
    else:
        # Create completely new combinations
        role = random.choice(job_roles)
        specialization = random.choice(['Platform', 'Infrastructure', 'Application', 'Systems', 'Enterprise', 'Cloud', 'Data'])
        title = f"{specialization} {role}"
    
    # Ensure uniqueness
    attempt = 0
    while title.lower() in existing_titles and attempt < 20:
        prefix = random.choice(job_prefixes + ['', ''])
        role = random.choice(job_roles)
        title = f"{prefix} {role}".strip()
        attempt += 1
    
    if title.lower() in existing_titles:
        title = f"{title} Specialist {i}"
    
    existing_titles.add(title.lower())
    
    # Generate skills (8-18 skills per job)
    num_skills = random.randint(8, 18)
    job_skills = random.sample(skills_pool, min(num_skills, len(skills_pool)))
    
    # Generate description
    desc_template = random.choice(descriptions)
    domain = random.choice(['software', 'cloud', 'data', 'security', 'AI/ML', 'infrastructure', 'application', 'enterprise', 'DevOps', 'platform'])
    description = desc_template.format(domain)
    
    # Add certifications (aim for 200 out of 500 to have certifications)
    # We need at least 200-56 = 144 jobs with certs from new jobs
    # So all 144 new jobs should have certifications
    certs = random.sample(certifications_pool, random.randint(1, 4))

    # Infer experience level from title hints and add salary range
    title_lower = title.lower()
    if any(k in title_lower for k in ['chief', 'head', 'director', 'vp', 'principal']):
        exp_level = 'Expert'
    elif any(k in title_lower for k in ['senior', 'lead', 'staff']):
        exp_level = 'Senior Level'
    elif any(k in title_lower for k in ['associate', 'mid']):
        exp_level = 'Mid Level'
    else:
        exp_level = random.choice(experience_levels)
    
    job = {
        "title": title,
        "description": description,
        "skillsRequired": sorted(job_skills),
        "experienceLevel": exp_level,
        "salary": salary_ranges[exp_level],
        "certifications": certs,
        "source": "generated"
    }
    
    new_jobs.append(job)

# Combine with existing jobs
all_jobs = existing_jobs + new_jobs

# Save to file
with open('merged_jobs_dataset.json', 'w', encoding='utf-8') as f:
    json.dump(all_jobs, f, indent=2, ensure_ascii=False)

# Update skills frequency
all_skills_freq = {}
for job in all_jobs:
    for skill in job.get('skillsRequired', []):
        skill_lower = skill.lower()
        all_skills_freq[skill_lower] = all_skills_freq.get(skill_lower, 0) + 1

# Create skills frequency data
skills_freq_data = {
    "total_unique_skills": len(all_skills_freq),
    "skills": [
        {"name": skill, "frequency": freq}
        for skill, freq in sorted(all_skills_freq.items(), key=lambda x: x[1], reverse=True)
    ]
}

with open('skills_frequency.json', 'w', encoding='utf-8') as f:
    json.dump(skills_freq_data, f, indent=2, ensure_ascii=False)

# Statistics
jobs_with_certs = sum(1 for job in all_jobs if job.get('certifications'))
print(f"✅ Generated {len(new_jobs)} new jobs")
print(f"✅ Total jobs: {len(all_jobs)}")
print(f"✅ Total unique skills: {len(all_skills_freq)}")
print(f"✅ Jobs with certifications: {jobs_with_certs}")
print(f"✅ New jobs titles (first 10): {[j['title'] for j in new_jobs[:10]]}")
