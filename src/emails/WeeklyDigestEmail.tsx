import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Preview,
  Hr,
  Img,
} from '@react-email/components';
import type { WeeklyTheme } from '@/lib/digest/generateWeeklySummary';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface WeeklyDigestEmailProps {
  dateRange: string;
  articleCount: number;
  themes: WeeklyTheme[];
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export function WeeklyDigestEmail({
  dateRange,
  articleCount,
  themes,
  unsubscribeUrl,
  preferencesUrl,
}: WeeklyDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {`Your explAI.in Weekly Summary — ${dateRange}`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="180"
              height="45"
              alt="explAI.in"
              style={styles.logoImg}
            />
            <Text style={styles.dateRange}>{dateRange}</Text>
          </Section>

          {/* Story count */}
          <Section style={styles.summary}>
            <Text style={styles.summaryText}>
              {articleCount} {articleCount === 1 ? 'story' : 'stories'} reviewed across your sources
            </Text>
          </Section>

          {/* AI Disclaimer */}
          <Section style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              AI summaries may contain errors — verify important details at the source.
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* Themes */}
          {themes.length > 0 ? (
            themes.map((theme, index) => (
              <Section key={index} style={styles.themeSection}>
                <Text style={styles.themeTitle}>{theme.title}</Text>
                <Text style={styles.themeSummary}>{theme.summary}</Text>
                {theme.sources.length > 0 && (
                  <Text style={styles.sourcePills}>
                    {theme.sources.map((source, i) => (
                      <span key={i}>
                        <span style={styles.sourcePill}>{source}</span>
                        {i < theme.sources.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </Text>
                )}
                {index < themes.length - 1 && <Hr style={styles.themeDivider} />}
              </Section>
            ))
          ) : (
            <Section style={styles.emptySection}>
              <Text style={styles.emptyText}>
                No themes available for this week.
              </Text>
            </Section>
          )}

          {/* Footer */}
          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              <Link href={preferencesUrl} style={styles.footerLink}>
                Manage preferences
              </Link>
              {' • '}
              <Link href={unsubscribeUrl} style={styles.footerLink}>
                Unsubscribe
              </Link>
            </Text>
            <Text style={styles.footerNote}>
              You received this email because you subscribed to explAI.in.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#FAFAF7',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: '#ffffff',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 30px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  logoImg: {
    margin: '0 auto 8px auto',
  },
  dateRange: {
    fontSize: '14px',
    color: '#6B6B6B',
    margin: 0,
  },
  summary: {
    textAlign: 'center' as const,
    marginBottom: '12px',
  },
  summaryText: {
    fontSize: '16px',
    color: '#2D2D2D',
    margin: 0,
  },
  disclaimer: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  disclaimerText: {
    fontSize: '12px',
    color: '#9B9B9B',
    fontStyle: 'italic' as const,
    margin: 0,
  },
  divider: {
    borderColor: '#E8E8E4',
    borderWidth: '1px',
    margin: '24px 0',
  },
  themeSection: {
    marginBottom: '8px',
  },
  themeTitle: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#2D2D2D',
    margin: '0 0 10px 0',
  },
  themeSummary: {
    fontSize: '14px',
    color: '#6B6B6B',
    lineHeight: '1.6',
    margin: '0 0 12px 0',
  },
  sourcePills: {
    fontSize: '12px',
    margin: '0 0 8px 0',
  },
  sourcePill: {
    backgroundColor: '#F9F7FD',
    color: '#B8A9E8',
    padding: '2px 10px',
    borderRadius: '12px',
    display: 'inline-block',
    marginRight: '4px',
    border: '1px solid #B8A9E8',
  },
  themeDivider: {
    borderColor: '#E8E8E4',
    borderWidth: '1px',
    margin: '20px 0',
  },
  emptySection: {
    textAlign: 'center' as const,
    padding: '20px 0',
  },
  emptyText: {
    fontSize: '14px',
    color: '#9B9B9B',
    margin: 0,
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '8px',
  },
  footerText: {
    fontSize: '14px',
    color: '#6B6B6B',
    margin: '0 0 8px 0',
  },
  footerLink: {
    color: '#B8A9E8',
    textDecoration: 'underline',
  },
  footerNote: {
    fontSize: '12px',
    color: '#9B9B9B',
    margin: 0,
  },
};

export default WeeklyDigestEmail;
