FROM node:18-slim

# Install system dependencies including LaTeX, browser dependencies, and PDF tools
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-latex-recommended \
    texlive-science \
    texlive-publishers \
    texlive-lang-english \
    ghostscript \
    python3 \
    python3-pip \
    python3-venv \
    # PDF processing tools
    poppler-utils \
    # Browser dependencies for Playwright
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatk1.0-0 \
    libgtk-3-0 \
    libdrm2 \
    libxss1 \
    libnss3 \
    libnspr4 \
    libatspi2.0-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatk1.0-0 \
    libgtk-3-0 \
    libxss1 \
    libnss3 \
    libnspr4 \
    libatspi2.0-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Create and activate Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies in virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN npx playwright install-deps
RUN npx playwright install chromium

# Copy application code
COPY . .

# Expose port
EXPOSE 5002

# Start the application
CMD ["npm", "start"] 