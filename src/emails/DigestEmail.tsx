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
import type { GroupedArticles } from '@/lib/digest/getUnsentArticles';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface DigestEmailProps {
  date: string;
  articleCount: number;
  groupedArticles: GroupedArticles[];
  unsubscribeUrl: string;
  preferencesUrl: string;
  keyTakeaways?: string[];
}

export function DigestEmail({
  date,
  articleCount,
  groupedArticles,
  unsubscribeUrl,
  preferencesUrl,
  keyTakeaways,
}: DigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {`Your explAI.in Digest - ${date} (${articleCount} stories)`}
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
            <Text style={styles.date}>{date}</Text>
          </Section>

          {/* Summary */}
          <Section style={styles.summary}>
            <Text style={styles.summaryText}>
              {articleCount} {articleCount === 1 ? 'story' : 'stories'} from your
              subscribed sources
            </Text>
          </Section>

          {/* Key Takeaways / TL;DR */}
          {keyTakeaways && keyTakeaways.length > 0 && (
            <Section style={styles.tldrSection}>
              <Text style={styles.tldrHeading}>Key Takeaways</Text>
              {keyTakeaways.map((takeaway, index) => (
                <Text key={index} style={styles.tldrItem}>
                  {`• ${takeaway}`}
                </Text>
              ))}
            </Section>
          )}

          <Hr style={styles.divider} />

          {/* Articles grouped by source */}
          {groupedArticles.map((group) => (
            <Section key={group.source_id} style={styles.sourceSection}>
              <Text style={styles.sourceName}>{group.source_name}</Text>

              {group.articles.map((article) => (
                <Section key={article.id} style={styles.article}>
                  <Link href={article.url} style={styles.headline}>
                    {article.headline}
                  </Link>
                  <Text style={styles.articleSummary}>{article.summary}</Text>
                  {article.tags && article.tags.length > 0 && (
                    <Text style={styles.tags}>
                      {article.tags.map((tag, i) => (
                        <span key={tag}>
                          <span style={styles.tag}>{tag}</span>
                          {i < article.tags.length - 1 ? ' ' : ''}
                        </span>
                      ))}
                    </Text>
                  )}
                </Section>
              ))}

              <Hr style={styles.sourceDivider} />
            </Section>
          ))}

          {/* Footer */}
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
  date: {
    fontSize: '14px',
    color: '#6B6B6B',
    margin: 0,
  },
  summary: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  summaryText: {
    fontSize: '16px',
    color: '#2D2D2D',
    margin: 0,
  },
  divider: {
    borderColor: '#E8E8E4',
    borderWidth: '1px',
    margin: '24px 0',
  },
  tldrSection: {
    backgroundColor: '#F9F7FD',
    borderRadius: '8px',
    padding: '20px 24px',
    marginBottom: '24px',
  },
  tldrHeading: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#2D2D2D',
    margin: '0 0 16px 0',
  },
  tldrItem: {
    fontSize: '15px',
    color: '#2D2D2D',
    lineHeight: '1.6',
    margin: '0 0 10px 0',
  },
  sourceSection: {
    marginBottom: '24px',
  },
  sourceName: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#B8A9E8',
    margin: '0 0 16px 0',
  },
  article: {
    marginBottom: '20px',
  },
  headline: {
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#B8A9E8',
    textDecoration: 'underline',
    display: 'block',
    marginBottom: '8px',
  },
  articleSummary: {
    fontSize: '14px',
    color: '#6B6B6B',
    lineHeight: '1.5',
    margin: '0 0 8px 0',
  },
  tags: {
    fontSize: '12px',
    margin: 0,
  },
  tag: {
    backgroundColor: '#F5F5F5',
    color: '#6B6B6B',
    padding: '2px 8px',
    borderRadius: '12px',
    display: 'inline-block',
    marginRight: '4px',
  },
  sourceDivider: {
    borderColor: '#E8E8E4',
    borderWidth: '1px',
    margin: '20px 0',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '32px',
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

export default DigestEmail;
