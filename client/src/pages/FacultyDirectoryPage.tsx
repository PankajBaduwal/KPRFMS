import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { facultyService } from '../services/faculty.service';
import {
  SkeletonTable,
  ErrorState,
  EmptyState,
  Badge,
  Button,
  PageHeader,
  Search,
  Pagination,
} from '../components';

export const FacultyDirectoryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: facultyList = [], isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['facultyDirectory'],
    queryFn: () => facultyService.getDirectory(),
    staleTime: 5 * 60 * 1000,
  });

  // Extract unique departments for filtering
  const departments = useMemo(() => {
    const set = new Set<string>();
    facultyList.forEach((f) => {
      if (f.departmentId?.name) set.add(f.departmentId.name);
    });
    return Array.from(set).sort();
  }, [facultyList]);

  // Memoized client-side filtering
  const filteredFaculty = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return facultyList.filter((f) => {
      const matchesSearch =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.employeeId.toLowerCase().includes(q) ||
        (f.designation && f.designation.toLowerCase().includes(q)) ||
        (f.departmentId?.name && f.departmentId.name.toLowerCase().includes(q));

      const matchesDept = !selectedDept || f.departmentId?.name === selectedDept;
      const matchesStatus = !selectedStatus || f.verificationStatus === selectedStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [facultyList, searchQuery, selectedDept, selectedStatus]);

  // Reset to page 1 whenever filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDept(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
    setCurrentPage(1);
  };

  const hasActiveFilters = !!(searchQuery.trim() || selectedDept || selectedStatus);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDept('');
    setSelectedStatus('');
    setCurrentPage(1);
  };

  // Memoized pagination slice to prevent rendering thousands of DOM elements
  const totalItems = filteredFaculty.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedFaculty = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFaculty.slice(start, start + pageSize);
  }, [filteredFaculty, currentPage, pageSize]);

  const getVerificationBadgeVariant = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'success';
      case 'REJECTED': return 'danger';
      default: return 'warning';
    }
  };

  if (isError) {
    return (
      <ErrorState
        title="Unable to load directory"
        message={(error as { message?: string })?.message || 'Failed to fetch directory.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="directory-page-container">
      <PageHeader
        title="Faculty Directory"
        subtitle="All faculty members and their profiles."
      />

      <div className="card-custom mb-4" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <Search
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Filter by name, ID, or designation..."
              clearable
              debounceMs={250}
            />
          </div>

          <div style={{ width: 'auto', minWidth: '180px' }}>
            <select
              className="form-control-custom select-custom"
              value={selectedDept}
              onChange={handleDeptChange}
              aria-label="Filter by department"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 'auto', minWidth: '150px' }}>
            <select
              className="form-control-custom select-custom"
              value={selectedStatus}
              onChange={handleStatusChange}
              aria-label="Filter by verification status"
            >
              <option value="">All Statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card-custom">
        {isFetching && !isLoading && (
          <div className="loading-bar" role="progressbar" aria-label="Refreshing directory" />
        )}
        {isLoading ? (
          <SkeletonTable rows={pageSize} columns={7} />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Faculty Member</th>
                    <th>Department</th>
                    <th>Employee ID</th>
                    <th>Publications</th>
                    <th>Teaching Exp.</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFaculty.length > 0 ? (
                    paginatedFaculty.map((f) => (
                      <tr key={f._id}>
                        <td>
                          <div>
                            <strong>{f.name}</strong>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                              {f.designation}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>{f.departmentId?.name || 'Department'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {f.departmentId?.code}
                          </div>
                        </td>
                        <td><code>{f.employeeId}</code></td>
                        <td>{f.publicationsCount ?? f.publications?.length ?? 0}</td>
                        <td>{f.totalTeachingExperienceYears ? `${f.totalTeachingExperienceYears.toFixed(1)} yrs` : '—'}</td>
                        <td>
                          <Badge variant={getVerificationBadgeVariant(f.verificationStatus)}>
                            {f.verificationStatus}
                          </Badge>
                        </td>
                        <td>
                          <Link to={`/portal/faculty/${f._id}`}>
                            <Button variant="outline" size="sm" icon={<i className="bi bi-person-lines-fill" />}>
                              View Profile
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        {hasActiveFilters ? (
                          <EmptyState
                            icon="bi-funnel"
                            title={selectedDept ? `No faculty members match your filters in ${selectedDept}` : 'No faculty members match your filters'}
                            reason="No records match the current search or filters."
                            secondaryAction={
                              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                                Clear filters
                              </Button>
                            }
                          />
                        ) : (
                          <EmptyState
                            icon="bi-people"
                            title="No faculty members in the directory"
                            reason="No faculty profiles have been registered in the institution yet."
                            nextStep="Faculty profiles will appear here once accounts are created by the administrator."
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalItems > 0 && (
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  pageSizeOptions={[10, 25, 50]}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
