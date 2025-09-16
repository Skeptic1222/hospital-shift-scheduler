-- Hospital Scheduler Database Optimizations
-- Performance improvements for SQL Server Express
-- Run these after initial schema creation

USE HospitalScheduler;
GO

-- ================================================
-- PERFORMANCE INDEXES
-- ================================================

-- Shifts table indexes
CREATE NONCLUSTERED INDEX IX_Shifts_Date_Status 
ON scheduler.shifts(shift_date, status) 
INCLUDE (department_id, start_time, end_time);

CREATE NONCLUSTERED INDEX IX_Shifts_Department 
ON scheduler.shifts(department_id, shift_date);

CREATE NONCLUSTERED INDEX IX_Shifts_AssignedTo 
ON scheduler.shifts(assigned_to) 
WHERE assigned_to IS NOT NULL;

-- Users table indexes
CREATE NONCLUSTERED INDEX IX_Users_Email 
ON scheduler.users(email) 
INCLUDE (first_name, last_name, role_id);

CREATE NONCLUSTERED INDEX IX_Users_Department 
ON scheduler.users(department_id, is_active);

CREATE NONCLUSTERED INDEX IX_Users_Role 
ON scheduler.users(role_id) 
WHERE is_active = 1;

-- Audit logs indexes (HIPAA compliance)
CREATE NONCLUSTERED INDEX IX_AuditLogs_Timestamp 
ON scheduler.audit_logs(timestamp DESC) 
INCLUDE (user_id, action, entity_type);

CREATE NONCLUSTERED INDEX IX_AuditLogs_User 
ON scheduler.audit_logs(user_id, timestamp DESC);

CREATE NONCLUSTERED INDEX IX_AuditLogs_Entity 
ON scheduler.audit_logs(entity_type, entity_id, timestamp DESC);

-- Queue table indexes
CREATE NONCLUSTERED INDEX IX_Queue_ShiftPosition 
ON scheduler.queue(shift_id, position) 
WHERE status = 'active';

CREATE NONCLUSTERED INDEX IX_Queue_Staff 
ON scheduler.queue(staff_id, status);

-- Notifications indexes
CREATE NONCLUSTERED INDEX IX_Notifications_User 
ON scheduler.notifications(user_id, created_at DESC) 
WHERE is_read = 0;

-- ================================================
-- PERFORMANCE VIEWS
-- ================================================

-- View for dashboard metrics
CREATE OR ALTER VIEW scheduler.vw_DashboardMetrics AS
SELECT 
    COUNT(DISTINCT s.id) as total_shifts,
    COUNT(DISTINCT CASE WHEN s.status = 'open' THEN s.id END) as open_shifts,
    COUNT(DISTINCT CASE WHEN s.status = 'filled' THEN s.id END) as filled_shifts,
    COUNT(DISTINCT u.id) as total_staff,
    COUNT(DISTINCT CASE WHEN s.shift_date = CAST(GETDATE() AS DATE) THEN u.id END) as staff_today,
    d.name as department_name,
    d.id as department_id
FROM scheduler.departments d
LEFT JOIN scheduler.shifts s ON d.id = s.department_id 
    AND s.shift_date >= DATEADD(DAY, -30, GETDATE())
LEFT JOIN scheduler.users u ON u.department_id = d.id 
    AND u.is_active = 1
GROUP BY d.name, d.id;
GO

-- View for staff availability
CREATE OR ALTER VIEW scheduler.vw_StaffAvailability AS
SELECT 
    u.id as user_id,
    u.first_name + ' ' + u.last_name as full_name,
    u.email,
    u.department_id,
    d.name as department_name,
    r.name as role_name,
    ISNULL(shift_count.total, 0) as shifts_this_week,
    ISNULL(shift_count.hours, 0) as hours_this_week,
    u.max_hours_per_week,
    CASE 
        WHEN ISNULL(shift_count.hours, 0) >= u.max_hours_per_week THEN 'Unavailable'
        WHEN ISNULL(shift_count.hours, 0) >= (u.max_hours_per_week * 0.8) THEN 'Limited'
        ELSE 'Available'
    END as availability_status
FROM scheduler.users u
INNER JOIN scheduler.departments d ON u.department_id = d.id
LEFT JOIN scheduler.roles r ON u.role_id = r.id
LEFT JOIN (
    SELECT 
        assigned_to,
        COUNT(*) as total,
        SUM(DATEDIFF(HOUR, start_time, end_time)) as hours
    FROM scheduler.shifts
    WHERE shift_date >= DATEADD(DAY, -7, GETDATE())
        AND shift_date < DATEADD(DAY, 1, GETDATE())
        AND status IN ('filled', 'partial')
    GROUP BY assigned_to
) shift_count ON shift_count.assigned_to = u.id
WHERE u.is_active = 1;
GO

-- View for shift assignments with staff details
CREATE OR ALTER VIEW scheduler.vw_ShiftAssignments AS
SELECT 
    s.id as shift_id,
    s.shift_date,
    s.start_time,
    s.end_time,
    s.status,
    s.department_id,
    d.name as department_name,
    s.assigned_to,
    u.first_name + ' ' + u.last_name as staff_name,
    u.email as staff_email,
    r.name as staff_role,
    s.notes,
    s.created_at,
    s.updated_at
FROM scheduler.shifts s
INNER JOIN scheduler.departments d ON s.department_id = d.id
LEFT JOIN scheduler.users u ON s.assigned_to = u.id
LEFT JOIN scheduler.roles r ON u.role_id = r.id;
GO

-- ================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- ================================================

-- Optimized shift search
CREATE OR ALTER PROCEDURE scheduler.sp_SearchShifts
    @StartDate DATE = NULL,
    @EndDate DATE = NULL,
    @DepartmentId NVARCHAR(50) = NULL,
    @Status NVARCHAR(20) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    WITH ShiftsCTE AS (
        SELECT 
            s.id,
            s.shift_date,
            s.start_time,
            s.end_time,
            s.status,
            s.department_id,
            d.name as department_name,
            s.assigned_to,
            u.first_name + ' ' + u.last_name as staff_name,
            s.notes,
            ROW_NUMBER() OVER (ORDER BY s.shift_date, s.start_time) as RowNum
        FROM scheduler.shifts s
        INNER JOIN scheduler.departments d ON s.department_id = d.id
        LEFT JOIN scheduler.users u ON s.assigned_to = u.id
        WHERE 
            (@StartDate IS NULL OR s.shift_date >= @StartDate)
            AND (@EndDate IS NULL OR s.shift_date <= @EndDate)
            AND (@DepartmentId IS NULL OR s.department_id = @DepartmentId)
            AND (@Status IS NULL OR s.status = @Status)
    )
    SELECT 
        id,
        shift_date,
        start_time,
        end_time,
        status,
        department_id,
        department_name,
        assigned_to,
        staff_name,
        notes,
        (SELECT COUNT(*) FROM ShiftsCTE) as TotalCount
    FROM ShiftsCTE
    WHERE RowNum BETWEEN ((@PageNumber - 1) * @PageSize + 1) 
        AND (@PageNumber * @PageSize)
    ORDER BY RowNum;
END;
GO

-- Get staff workload
CREATE OR ALTER PROCEDURE scheduler.sp_GetStaffWorkload
    @StaffId UNIQUEIDENTIFIER,
    @StartDate DATE,
    @EndDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) as total_shifts,
        SUM(DATEDIFF(HOUR, start_time, end_time)) as total_hours,
        COUNT(DISTINCT shift_date) as days_worked,
        MIN(shift_date) as first_shift,
        MAX(shift_date) as last_shift,
        AVG(DATEDIFF(HOUR, start_time, end_time)) as avg_shift_length
    FROM scheduler.shifts
    WHERE assigned_to = @StaffId
        AND shift_date BETWEEN @StartDate AND @EndDate
        AND status IN ('filled', 'partial');
        
    -- Return detailed shift list
    SELECT 
        shift_date,
        start_time,
        end_time,
        department_id,
        status,
        DATEDIFF(HOUR, start_time, end_time) as hours
    FROM scheduler.shifts
    WHERE assigned_to = @StaffId
        AND shift_date BETWEEN @StartDate AND @EndDate
        AND status IN ('filled', 'partial')
    ORDER BY shift_date, start_time;
END;
GO

-- ================================================
-- MAINTENANCE PROCEDURES
-- ================================================

-- Update statistics for query optimization
CREATE OR ALTER PROCEDURE scheduler.sp_UpdateStatistics
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE STATISTICS scheduler.shifts WITH FULLSCAN;
    UPDATE STATISTICS scheduler.users WITH FULLSCAN;
    UPDATE STATISTICS scheduler.departments WITH FULLSCAN;
    UPDATE STATISTICS scheduler.audit_logs WITH FULLSCAN;
    UPDATE STATISTICS scheduler.queue WITH FULLSCAN;
    UPDATE STATISTICS scheduler.notifications WITH FULLSCAN;
    
    -- Rebuild fragmented indexes
    DECLARE @TableName NVARCHAR(255);
    DECLARE @IndexName NVARCHAR(255);
    DECLARE @SQL NVARCHAR(MAX);
    
    DECLARE index_cursor CURSOR FOR
    SELECT 
        t.name AS TableName,
        i.name AS IndexName
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') AS ps
    INNER JOIN sys.indexes AS i ON ps.object_id = i.object_id AND ps.index_id = i.index_id
    INNER JOIN sys.tables AS t ON i.object_id = t.object_id
    INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
    WHERE ps.avg_fragmentation_in_percent > 30
        AND ps.index_id > 0
        AND s.name = 'scheduler';
    
    OPEN index_cursor;
    FETCH NEXT FROM index_cursor INTO @TableName, @IndexName;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @SQL = 'ALTER INDEX [' + @IndexName + '] ON scheduler.[' + @TableName + '] REBUILD';
        EXEC sp_executesql @SQL;
        FETCH NEXT FROM index_cursor INTO @TableName, @IndexName;
    END;
    
    CLOSE index_cursor;
    DEALLOCATE index_cursor;
    
    PRINT 'Statistics updated and indexes rebuilt successfully';
END;
GO

-- ================================================
-- SCHEDULED JOBS (Run these as SQL Agent Jobs)
-- ================================================

-- Clean up old audit logs (keep 7 years for HIPAA)
CREATE OR ALTER PROCEDURE scheduler.sp_CleanupAuditLogs
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @CutoffDate DATETIME = DATEADD(YEAR, -7, GETDATE());
    
    DELETE FROM scheduler.audit_logs
    WHERE timestamp < @CutoffDate;
    
    PRINT 'Deleted ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' old audit records';
END;
GO

-- Archive old shifts
CREATE OR ALTER PROCEDURE scheduler.sp_ArchiveOldShifts
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Archive shifts older than 1 year
    DECLARE @ArchiveDate DATE = DATEADD(YEAR, -1, GETDATE());
    
    -- Create archive table if not exists
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'shifts_archive' AND schema_id = SCHEMA_ID('scheduler'))
    BEGIN
        SELECT * INTO scheduler.shifts_archive 
        FROM scheduler.shifts WHERE 1 = 0;
    END
    
    -- Move old shifts to archive
    INSERT INTO scheduler.shifts_archive
    SELECT * FROM scheduler.shifts
    WHERE shift_date < @ArchiveDate;
    
    DELETE FROM scheduler.shifts
    WHERE shift_date < @ArchiveDate;
    
    PRINT 'Archived ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' old shifts';
END;
GO

-- ================================================
-- GRANT PERMISSIONS
-- ================================================

-- Grant execute permissions on stored procedures
GRANT EXECUTE ON scheduler.sp_SearchShifts TO [scheduler_app];
GRANT EXECUTE ON scheduler.sp_GetStaffWorkload TO [scheduler_app];
GRANT EXECUTE ON scheduler.sp_UpdateStatistics TO [scheduler_admin];
GRANT EXECUTE ON scheduler.sp_CleanupAuditLogs TO [scheduler_admin];
GRANT EXECUTE ON scheduler.sp_ArchiveOldShifts TO [scheduler_admin];

-- Grant select on views
GRANT SELECT ON scheduler.vw_DashboardMetrics TO [scheduler_app];
GRANT SELECT ON scheduler.vw_StaffAvailability TO [scheduler_app];
GRANT SELECT ON scheduler.vw_ShiftAssignments TO [scheduler_app];

PRINT 'Database optimizations completed successfully';