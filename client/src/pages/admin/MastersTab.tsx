// Extracted from AdminPage.tsx — the "masters" tab.
import { MASTER_CATEGORIES, MASTER_CATEGORY_LABELS } from '../../types/admin';
import { EmptyState } from '../../components/EmptyState';
import React from 'react';
import type { IAdminMasterItem } from '../../types/admin';

export interface MastersTabProps {
  filteredMasterItems: IAdminMasterItem[];
  handleDeleteMaster: (item: IAdminMasterItem) => void;
  handleToggleMasterStatus: (item: IAdminMasterItem) => Promise<void>;
  masterCategory: string;
  masterItems: IAdminMasterItem[];
  masterSearch: string;
  masterStatusFilter: "ALL" | "ACTIVE" | "INACTIVE";
  setEditingMaster: React.Dispatch<React.SetStateAction<IAdminMasterItem | null>>;
  setMasterCategory: React.Dispatch<React.SetStateAction<string>>;
  setMasterFormData: React.Dispatch<React.SetStateAction<{ code: string; name: string; description: string; order: number; weightage: number; defaultDays: number; cadre: string; agencyCategory: string; isActive: boolean; }>>;
  setMasterModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMasterSearch: React.Dispatch<React.SetStateAction<string>>;
  setMasterStatusFilter: React.Dispatch<React.SetStateAction<"ALL" | "ACTIVE" | "INACTIVE">>;
}

export const MastersTab: React.FC<MastersTabProps> = ({ filteredMasterItems, handleDeleteMaster, handleToggleMasterStatus, masterCategory, masterItems, masterSearch, masterStatusFilter, setEditingMaster, setMasterCategory, setMasterFormData, setMasterModalOpen, setMasterSearch, setMasterStatusFilter }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Category Selector Bar */}
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {Object.entries(MASTER_CATEGORIES).map(([catKey, catVal]) => {
                    const isSelected = masterCategory === catVal;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => {
                          setMasterCategory(catVal);
                          setMasterSearch('');
                        }}
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                      >
                        {MASTER_CATEGORY_LABELS[catVal] || catVal}
                      </button>
                    );
                  })}
                </div>
  
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingMaster(null);
                    setMasterFormData({
                      code: '',
                      name: '',
                      description: '',
                      order: masterItems.length + 1,
                      weightage: 0,
                      defaultDays: 0,
                      cadre: '',
                      agencyCategory: '',
                      isActive: true,
                    });
                    setMasterModalOpen(true);
                  }}
                >
                  <i className="bi bi-plus-lg me-1" /> Add {MASTER_CATEGORY_LABELS[masterCategory]?.slice(0, -1) || 'Item'}
                </button>
              </div>
  
              {/* Master Search & Filter Sub-Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder={`Search in ${MASTER_CATEGORY_LABELS[masterCategory] || 'items'}...`}
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  style={{ maxWidth: '280px' }}
                />
                <select
                  className="form-select form-select-sm"
                  value={masterStatusFilter}
                  onChange={(e) => setMasterStatusFilter(e.target.value as any)}
                  style={{ width: 'auto' }}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Records</option>
                  <option value="INACTIVE">Inactive Records</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Showing <strong>{filteredMasterItems.length}</strong> of {masterItems.length} items
                </span>
              </div>
            </div>
  
            {/* Master Items Table */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '60px' }}>Order</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Name / Label</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Description</th>
                      {masterCategory === 'DESIGNATION' && (
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Cadre / Track</th>
                      )}
                      {masterCategory === 'FUNDING_AGENCY' && (
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Agency Category</th>
                      )}
                      {(masterCategory === 'PUBLICATION_TYPE' || masterCategory === 'ACTIVITY_TYPE') && (
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>API Points</th>
                      )}
                      {masterCategory === 'LEAVE_TYPE' && (
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Default Quota</th>
                      )}
                      {masterCategory === 'APPRAISAL_CRITERIA' && (
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Weightage %</th>
                      )}
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterItems.length > 0 ? (
                      filteredMasterItems.map((item) => (
                        <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{item.order}</td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{item.code}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{item.description || '—'}</td>
                          {masterCategory === 'DESIGNATION' && (
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-light text-dark border">{item.cadre || 'Teaching'}</span>
                            </td>
                          )}
                          {masterCategory === 'FUNDING_AGENCY' && (
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-light text-dark border">{item.agencyCategory || 'Government'}</span>
                            </td>
                          )}
                          {(masterCategory === 'PUBLICATION_TYPE' || masterCategory === 'ACTIVITY_TYPE') && (
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-primary">{item.weightage ?? 0} Pts</span>
                            </td>
                          )}
                          {masterCategory === 'LEAVE_TYPE' && (
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.defaultDays ?? 0} Days</td>
                          )}
                          {masterCategory === 'APPRAISAL_CRITERIA' && (
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge bg-success">{item.weightage ?? 0}%</span>
                            </td>
                          )}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              className={`badge ${item.isSystem ? 'bg-secondary' : 'bg-info text-dark'}`}
                              style={{ fontSize: '0.7rem' }}
                            >
                              {item.isSystem ? 'SYSTEM' : 'CUSTOM'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 600,
                                backgroundColor: item.isActive ? '#dcfce7' : '#fee2e2',
                                color: item.isActive ? '#15803d' : '#991b1b',
                              }}
                            >
                              {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                title={item.isActive ? 'Deactivate' : 'Activate'}
                                onClick={() => handleToggleMasterStatus(item)}
                              >
                                <i className={`bi ${item.isActive ? 'bi-toggle-on' : 'bi-toggle-off'}`} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditingMaster(item);
                                  setMasterFormData({
                                    code: item.code,
                                    name: item.name,
                                    description: item.description || '',
                                    order: item.order,
                                    weightage: item.weightage || 0,
                                    defaultDays: item.defaultDays || 0,
                                    cadre: item.cadre || '',
                                    agencyCategory: item.agencyCategory || '',
                                    isActive: item.isActive,
                                  });
                                  setMasterModalOpen(true);
                                }}
                              >
                                <i className="bi bi-pencil" />
                              </button>
                              {!item.isSystem && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDeleteMaster(item)}
                                >
                                  <i className="bi bi-trash" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} style={{ padding: 0 }}>
                          {masterSearch.trim() || masterStatusFilter !== 'ALL' ? (
                            <EmptyState
                              icon="bi-funnel"
                              title={`No matching ${MASTER_CATEGORY_LABELS[masterCategory] || masterCategory} items`}
                              reason="No records match the current search or status filter."
                              nextStep="Clear the search box or reset the status filter to see all records."
                              compact
                            />
                          ) : (
                            <EmptyState
                              icon="bi-tags"
                              title={`No ${MASTER_CATEGORY_LABELS[masterCategory] || masterCategory} items registered`}
                              reason="No values have been added under this master data category yet, so its dropdowns will be empty."
                              nextStep="Use Add Item above to add the first value."
                              compact
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
  );
};
