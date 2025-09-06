-- =====================================================
-- FCFS Stored Procedures for SQL Server Express
-- Optimized for 15-minute window queue management
-- =====================================================

USE HospitalScheduler;
GO

-- =====================================================
-- Get Eligible Workers for Open Shift
-- =====================================================
CREATE OR ALTER PROCEDURE scheduler.GetEligibleWorkers
    @ShiftId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    WITH ShiftDetails AS (
        SELECT 
            s.*,
            d.id as department_id,
            d.name as department_name
        FROM scheduler.shifts s
        JOIN scheduler.departments d ON s.department_id = d.id
        WHERE s.id = @ShiftId
    ),
    WorkerAvailability AS (
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.skills,
            u.certifications,
            u.hire_date,
            wht.fatigue_score,
            wht.total_hours_worked,
            wht.consecutive_days_worked,
            (SELECT COUNT(*) FROM scheduler.shift_assignments sa 
             WHERE sa.user_id = u.id 
             AND sa.status NOT IN ('declined', 'cancelled')
             AND sa.created_at > DATEADD(DAY, -7, GETDATE())) as shifts_this_week,
            (SELECT MAX(assigned_at) FROM scheduler.shift_assignments 
             WHERE user_id = u.id) as last_shift_assigned
        FROM scheduler.users u
        LEFT JOIN scheduler.work_hours_tracking wht 
            ON u.id = wht.user_id 
            AND wht.week_start = DATEADD(DAY, 1-DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE))
        WHERE u.is_active = 1
            AND u.department_id = (SELECT department_id FROM ShiftDetails)
            AND u.id NOT IN (
                SELECT user_id 
                FROM scheduler.shift_assignments 
                WHERE shift_id = @ShiftId 
                AND status NOT IN ('declined', 'cancelled')
            )
    )
    SELECT 
        wa.*,
        sd.start_datetime,
        sd.end_datetime,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM scheduler.shift_assignments sa2
                JOIN scheduler.shifts s2 ON sa2.shift_id = s2.id
                WHERE sa2.user_id = wa.id
                AND sa2.status IN ('assigned', 'confirmed')
                AND s2.start_datetime < sd.end_datetime
                AND s2.end_datetime > sd.start_datetime
            ) THEN 0
            ELSE 1
        END as is_available,
        CASE 
            WHEN ISNULL(wa.total_hours_worked, 0) + 
                DATEDIFF(HOUR, sd.start_datetime, sd.end_datetime) > 40 
            THEN 1 
            ELSE 0 
        END as would_cause_overtime,
        -- Calculate priority score
        CAST(
            -- Seniority (30%)
            (CASE WHEN wa.hire_date IS NOT NULL 
                THEN DATEDIFF(DAY, wa.hire_date, GETDATE()) / 365.0 * 30
                ELSE 0 END) +
            -- Last shift worked (20%)
            (CASE WHEN wa.last_shift_assigned IS NOT NULL
                THEN LEAST(DATEDIFF(DAY, wa.last_shift_assigned, GETDATE()) / 7.0, 1) * 20
                ELSE 20 END) +
            -- Low fatigue (25%)
            (CASE WHEN wa.fatigue_score IS NOT NULL
                THEN (100 - wa.fatigue_score) / 100.0 * 25
                ELSE 25 END) +
            -- Availability (25%)
            25
        AS DECIMAL(5,2)) as priority_score
    FROM WorkerAvailability wa
    CROSS JOIN ShiftDetails sd
    WHERE 
        (wa.fatigue_score IS NULL OR wa.fatigue_score < 75)
        AND (wa.consecutive_days_worked IS NULL OR wa.consecutive_days_worked < 6)
    ORDER BY priority_score DESC;
END;
GO

-- =====================================================
-- Create FCFS Queue for Open Shift
-- =====================================================
CREATE OR ALTER PROCEDURE scheduler.CreateFCFSQueue
    @OpenShiftId UNIQUEIDENTIFIER,
    @WindowDurationMinutes INT = 15,
    @MaxQueueSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ShiftId UNIQUEIDENTIFIER;
    DECLARE @CurrentTime DATETIME2 = GETUTCDATE();
    
    -- Get shift ID
    SELECT @ShiftId = shift_id 
    FROM scheduler.open_shift_requests 
    WHERE id = @OpenShiftId;
    
    -- Get eligible workers
    CREATE TABLE #EligibleWorkers (
        user_id UNIQUEIDENTIFIER,
        priority_score DECIMAL(5,2),
        queue_position INT
    );
    
    INSERT INTO #EligibleWorkers (user_id, priority_score)
    EXEC scheduler.GetEligibleWorkers @ShiftId;
    
    -- Assign queue positions
    UPDATE #EligibleWorkers
    SET queue_position = ROW_NUMBER() OVER (ORDER BY priority_score DESC);
    
    -- Insert into FCFS queue with staggered windows
    INSERT INTO scheduler.fcfs_queue (
        open_shift_id,
        user_id,
        queue_position,
        window_starts_at,
        window_expires_at
    )
    SELECT TOP (@MaxQueueSize)
        @OpenShiftId,
        user_id,
        queue_position,
        DATEADD(MINUTE, (queue_position - 1) * @WindowDurationMinutes, @CurrentTime) as window_starts_at,
        DATEADD(MINUTE, queue_position * @WindowDurationMinutes, @CurrentTime) as window_expires_at
    FROM #EligibleWorkers
    ORDER BY queue_position;
    
    -- Return queue summary
    SELECT 
        COUNT(*) as queue_size,
        MIN(window_starts_at) as first_window_start,
        MAX(window_expires_at) as last_window_expires
    FROM scheduler.fcfs_queue
    WHERE open_shift_id = @OpenShiftId;
    
    DROP TABLE #EligibleWorkers;
END;
GO

-- =====================================================
-- Progress FCFS Queue to Next Worker
-- =====================================================
CREATE OR ALTER PROCEDURE scheduler.ProgressFCFSQueue
    @OpenShiftId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @NextUserId UNIQUEIDENTIFIER;
    DECLARE @NextQueueId UNIQUEIDENTIFIER;
    DECLARE @CurrentTime DATETIME2 = GETUTCDATE();
    DECLARE @WindowDuration INT = 15; -- minutes
    
    BEGIN TRANSACTION;
    
    -- Expire current window if no response
    UPDATE scheduler.fcfs_queue
    SET response_status = 'expired'
    WHERE open_shift_id = @OpenShiftId
        AND window_expires_at <= @CurrentTime
        AND response_status = 'waiting';
    
    -- Find next waiting person in queue
    SELECT TOP 1 
        @NextQueueId = id,
        @NextUserId = user_id
    FROM scheduler.fcfs_queue
    WHERE open_shift_id = @OpenShiftId
        AND response_status = 'waiting'
        AND window_starts_at > @CurrentTime
    ORDER BY queue_position ASC;
    
    IF @NextQueueId IS NOT NULL
    BEGIN
        -- Update their window to start now
        UPDATE scheduler.fcfs_queue
        SET window_starts_at = @CurrentTime,
            window_expires_at = DATEADD(MINUTE, @WindowDuration, @CurrentTime)
        WHERE id = @NextQueueId;
        
        -- Return updated queue entry for notification
        SELECT 
            q.*,
            u.email,
            u.phone,
            u.first_name,
            u.last_name
        FROM scheduler.fcfs_queue q
        JOIN scheduler.users u ON q.user_id = u.id
        WHERE q.id = @NextQueueId;
    END
    ELSE
    BEGIN
        -- No one left in queue, expire the open shift request
        UPDATE scheduler.open_shift_requests
        SET status = 'expired'
        WHERE id = @OpenShiftId AND status = 'open';
    END
    
    COMMIT TRANSACTION;
END;
GO

-- =====================================================
-- Accept Shift from FCFS Queue
-- =====================================================
CREATE OR ALTER PROCEDURE scheduler.AcceptShiftFromQueue
    @QueueEntryId UNIQUEIDENTIFIER,
    @UserId UNIQUEIDENTIFIER,
    @Response NVARCHAR(20) -- 'accepted' or 'declined'
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @OpenShiftId UNIQUEIDENTIFIER;
    DECLARE @ShiftId UNIQUEIDENTIFIER;
    DECLARE @IsValid BIT = 0;
    DECLARE @Result NVARCHAR(50);
    
    BEGIN TRANSACTION;
    
    -- Verify the window is still active
    SELECT 
        @OpenShiftId = open_shift_id,
        @IsValid = CASE 
            WHEN response_status = 'waiting' 
                AND window_expires_at > GETUTCDATE()
                AND user_id = @UserId
            THEN 1 
            ELSE 0 
        END
    FROM scheduler.fcfs_queue WITH (UPDLOCK)
    WHERE id = @QueueEntryId;
    
    IF @IsValid = 0
    BEGIN
        SET @Result = 'INVALID_OR_EXPIRED';
        ROLLBACK TRANSACTION;
        SELECT @Result as result;
        RETURN;
    END
    
    -- Update queue entry
    UPDATE scheduler.fcfs_queue
    SET response_status = @Response,
        responded_at = GETUTCDATE()
    WHERE id = @QueueEntryId;
    
    IF @Response = 'accepted'
    BEGIN
        -- Get shift ID
        SELECT @ShiftId = shift_id
        FROM scheduler.open_shift_requests
        WHERE id = @OpenShiftId;
        
        -- Assign the shift
        INSERT INTO scheduler.shift_assignments (
            shift_id,
            user_id,
            status,
            assigned_at
        ) VALUES (
            @ShiftId,
            @UserId,
            'assigned',
            GETUTCDATE()
        );
        
        -- Update shift status
        UPDATE scheduler.shifts
        SET status = 'filled',
            updated_at = GETUTCDATE()
        WHERE id = @ShiftId;
        
        -- Mark open shift as filled
        UPDATE scheduler.open_shift_requests
        SET status = 'filled',
            filled_at = GETUTCDATE(),
            filled_by = @UserId
        WHERE id = @OpenShiftId;
        
        -- Expire remaining queue entries
        UPDATE scheduler.fcfs_queue
        SET response_status = 'expired'
        WHERE open_shift_id = @OpenShiftId
            AND response_status = 'waiting';
        
        SET @Result = 'SHIFT_ASSIGNED';
    END
    ELSE
    BEGIN
        -- Progress to next in queue
        EXEC scheduler.ProgressFCFSQueue @OpenShiftId;
        SET @Result = 'DECLINED_PROGRESSED';
    END
    
    -- Audit log
    INSERT INTO audit.audit_log (
        action,
        resource_type,
        resource_id,
        user_id,
        additional_data
    ) VALUES (
        'QUEUE_RESPONSE_' + @Response,
        'fcfs_queue',
        @QueueEntryId,
        @UserId,
        JSON_QUERY('{"open_shift_id":"' + CAST(@OpenShiftId AS NVARCHAR(50)) + '"}')
    );
    
    COMMIT TRANSACTION;
    
    SELECT @Result as result, @ShiftId as shift_id;
END;
GO

-- =====================================================
-- Get Queue Analytics
-- =====================================================
CREATE OR ALTER PROCEDURE scheduler.GetQueueAnalytics
    @HospitalId UNIQUEIDENTIFIER,
    @StartDate DATE,
    @EndDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(DISTINCT osr.id) as total_open_shifts,
        COUNT(DISTINCT CASE WHEN osr.status = 'filled' THEN osr.id END) as filled_shifts,
        COUNT(DISTINCT CASE WHEN osr.status = 'expired' THEN osr.id END) as expired_shifts,
        AVG(CASE WHEN osr.filled_at IS NOT NULL 
            THEN DATEDIFF(MINUTE, osr.posted_at, osr.filled_at) 
            END) as avg_fill_time_minutes,
        COUNT(DISTINCT q.user_id) as unique_workers_queued,
        AVG(CAST(q.queue_position AS FLOAT)) as avg_queue_position_filled,
        SUM(CASE WHEN q.response_status = 'accepted' THEN 1 ELSE 0 END) * 100.0 / 
            NULLIF(SUM(CASE WHEN q.response_status IN ('accepted', 'declined') THEN 1 ELSE 0 END), 0) as acceptance_rate
    FROM scheduler.open_shift_requests osr
    LEFT JOIN scheduler.fcfs_queue q ON osr.id = q.open_shift_id
    JOIN scheduler.shifts s ON osr.shift_id = s.id
    WHERE s.hospital_id = @HospitalId
        AND osr.posted_at BETWEEN @StartDate AND @EndDate;
END;
GO

-- =====================================================
-- Update Fatigue Scores
-- =====================================================
CREATE OR ALTER PROCEDURE scheduler.UpdateFatigueScores
    @HospitalId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @WeekStart DATE = DATEADD(DAY, 1-DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE));
    
    -- Update work hours tracking
    MERGE scheduler.work_hours_tracking AS target
    USING (
        SELECT 
            u.id as user_id,
            @WeekStart as week_start,
            SUM(DATEDIFF(HOUR, s.start_datetime, s.end_datetime)) as total_hours,
            COUNT(DISTINCT CAST(s.shift_date AS DATE)) as days_worked
        FROM scheduler.users u
        LEFT JOIN scheduler.shift_assignments sa ON u.id = sa.user_id
        LEFT JOIN scheduler.shifts s ON sa.shift_id = s.id
        WHERE u.hospital_id = @HospitalId
            AND sa.status IN ('assigned', 'confirmed', 'completed')
            AND s.shift_date >= @WeekStart
            AND s.shift_date < DATEADD(WEEK, 1, @WeekStart)
        GROUP BY u.id
    ) AS source
    ON target.user_id = source.user_id AND target.week_start = source.week_start
    WHEN MATCHED THEN
        UPDATE SET 
            total_hours_scheduled = source.total_hours,
            total_hours_worked = source.total_hours,
            overtime_hours = CASE WHEN source.total_hours > 40 THEN source.total_hours - 40 ELSE 0 END,
            consecutive_days_worked = source.days_worked,
            updated_at = GETUTCDATE()
    WHEN NOT MATCHED THEN
        INSERT (user_id, week_start, total_hours_scheduled, total_hours_worked, consecutive_days_worked)
        VALUES (source.user_id, source.week_start, source.total_hours, source.total_hours, source.days_worked);
    
    -- Calculate and update fatigue scores
    UPDATE scheduler.work_hours_tracking
    SET fatigue_score = scheduler.CalculateFatigueScore(user_id, week_start)
    WHERE week_start = @WeekStart
        AND user_id IN (SELECT id FROM scheduler.users WHERE hospital_id = @HospitalId);
END;
GO

-- =====================================================
-- Scheduled Job: Clean Expired Queue Entries
-- =====================================================
CREATE OR ALTER PROCEDURE scheduler.MaintenanceCleanup
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Clean expired queue entries
    EXEC scheduler.CleanupExpiredQueueEntries;
    
    -- Update fatigue scores for all hospitals
    DECLARE @HospitalId UNIQUEIDENTIFIER;
    DECLARE hospital_cursor CURSOR FOR
        SELECT id FROM scheduler.hospitals WHERE 1=1;
    
    OPEN hospital_cursor;
    FETCH NEXT FROM hospital_cursor INTO @HospitalId;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC scheduler.UpdateFatigueScores @HospitalId;
        FETCH NEXT FROM hospital_cursor INTO @HospitalId;
    END
    
    CLOSE hospital_cursor;
    DEALLOCATE hospital_cursor;
    
    -- Archive old audit logs (keep 7 years)
    EXEC audit.ArchiveOldLogs @DaysToKeep = 2555;
    
    PRINT 'Maintenance cleanup completed at ' + CONVERT(NVARCHAR(30), GETUTCDATE(), 121);
END;
GO

PRINT 'FCFS Stored Procedures created successfully!';