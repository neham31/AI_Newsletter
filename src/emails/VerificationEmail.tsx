import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface VerificationEmailProps {
  verificationUrl: string;
}

export const VerificationEmail = ({
  verificationUrl,
}: VerificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Confirm your AI Digest subscription</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>AI Digest</Heading>
          <Text style={paragraph}>
            Thanks for signing up for AI Digest! Please confirm your email
            address to start receiving your personalized AI news digest.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Confirm Subscription
            </Button>
          </Section>
          <Text style={paragraph}>
            If you didn&apos;t sign up for AI Digest, you can safely ignore this
            email.
          </Text>
          <Text style={footer}>
            This link will expire in 24 hours. If you need a new confirmation
            link, please sign up again.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#FAFAF7',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
  borderRadius: '8px',
};

const heading = {
  color: '#2D2D2D',
  fontSize: '28px',
  fontWeight: '700',
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const paragraph = {
  color: '#2D2D2D',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#B8A9E8',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const footer = {
  color: '#9B9B9B',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 0 0',
};

export default VerificationEmail;
