// Extracted from FacultyProfilePage.tsx — the "projects" tab.
import { EmptyState, Badge } from '../../components';
import React from 'react';
import type { FacultyProfile } from '../../types/index';

export interface ProjectsTabProps {
  profile: FacultyProfile;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({ profile }) => {
  return (
    <div className="card-custom">
            <h2 className="card-title">Student Projects Guided</h2>
            {(!profile.studentProjects || profile.studentProjects.length === 0) ? (
              <EmptyState
                compact
                icon="bi-folder2"
                title="No guided student projects recorded"
                reason="No student projects have been linked to this faculty member as guide yet."
                nextStep="Student projects registered with this faculty member as guide will appear here."
              />
            ) : (
            <div className="table-responsive">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Project Title</th>
                    <th>Level</th>
                    <th>Academic Year</th>
                    <th>Students</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.studentProjects?.map((sp, idx) => (
                    <tr key={idx}>
                      <td><strong>{sp.title}</strong></td>
                      <td><Badge variant="neutral">{sp.projectType}</Badge></td>
                      <td>{sp.academicYear}</td>
                      <td>{sp.students?.join(', ')}</td>
                      <td><span style={{ fontSize: '0.8125rem' }}>{sp.outcome || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
  );
};
