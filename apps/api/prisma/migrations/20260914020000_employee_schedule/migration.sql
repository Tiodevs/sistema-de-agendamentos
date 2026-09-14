-- CreateTable
CREATE TABLE "employee_business_hours" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_special_days" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_special_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_business_hours_employeeId_idx" ON "employee_business_hours"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_business_hours_employeeId_dayOfWeek_key" ON "employee_business_hours"("employeeId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "employee_special_days_employeeId_idx" ON "employee_special_days"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_special_days_employeeId_date_key" ON "employee_special_days"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "employee_business_hours" ADD CONSTRAINT "employee_business_hours_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_special_days" ADD CONSTRAINT "employee_special_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
