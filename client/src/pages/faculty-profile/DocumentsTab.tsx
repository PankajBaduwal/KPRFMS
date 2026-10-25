// Extracted from FacultyProfilePage.tsx — the "documents" tab.
import { EmptyState, Badge, Button } from '../../components';
import React from 'react';
import type { FacultyProfile } from '../../types/index';

export interface DocumentsTabProps {
  profile: FacultyProfile;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ profile }) => {
  return (
    <div className="card-custom">
            <h2 className="card-title">Supporting documents</h2>
            {(!profile.supportingDocuments || profile.supportingDocuments.length === 0) ? (
              <EmptyState
                compact
                icon="bi-file-earmark"
                title="No supporting documents uploaded"
                reason="No institutional documents have been attached to this profile yet."
                nextStep="Certificates uploaded with qualification, experience and research records are listed in their own tabs."
              />
            ) : (
            <div className="table-responsive">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Document Title</th>
                    <th>Type</th>
                    <th>Uploaded Date</th>
                    <th>Verification</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.supportingDocuments?.map((doc, idx) => (
                    <tr key={idx}>
                      <td><strong>{doc.title}</strong></td>
                      <td><Badge variant="neutral">{doc.documentType}</Badge></td>
                      <td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                      <td>
                        <Badge variant={doc.isVerified ? 'success' : 'warning'}>
                          {doc.isVerified ? 'Verified' : 'Pending'}
                        </Badge>
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" icon={<i className="bi bi-download" />}>
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
  );
};
