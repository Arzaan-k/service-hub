import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface ExpenseBreakdown {
  hotelAllowance: number;
  foodAllowance: number;
  localTravelAllowance: number;
  personalAllowance: number;
}

interface TechnicianExpense {
  technicianId: string;
  technicianName: string;
  designation: string;
  employeeCode: string;
  year: number;
  month: number | null;
  daysWorked: number;
  servicesCompleted: number;
  dailyWage: number;
  totalWages: number;
  totalAllowances: number;
  totalCost: number;
  breakdown: ExpenseBreakdown;
}

interface ExpenseTotals {
  totalDaysWorked: number;
  totalServicesCompleted: number;
  totalCost: number;
  totalWages: number;
  totalAllowances: number;
}

function TechnicianExpenseHistory() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [expenses, setExpenses] = useState<TechnicianExpense[]>([]);
  const [totals, setTotals] = useState<ExpenseTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchExpenses();
  }, [selectedYear, selectedMonth]);
  
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const monthParam = selectedMonth !== 'all' ? `&month=${selectedMonth}` : '';
      const response = await apiRequest(
        'GET',
        `/api/technicians/expenses?year=${selectedYear}${monthParam}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch expense data');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setExpenses(data.expenses);
        setTotals(data.totals);
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to fetch expense data',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch expense data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const exportToCSV = () => {
    const csvContent = [
      ['Technician', 'Employee Code', 'Designation', 'Days Worked', 'Services', 'Total Wages', 'Total Allowances', 'Total Cost'],
      ...expenses.map(e => [
        e.technicianName,
        e.employeeCode || '',
        e.designation,
        e.daysWorked,
        e.servicesCompleted,
        e.totalWages,
        e.totalAllowances,
        e.totalCost
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `technician-expenses-${selectedYear}-${selectedMonth || 'all'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  
  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-blue-600" />
                Expense History
              </CardTitle>
              <p className="text-gray-600 mt-1">
                Track overall costs per technician
              </p>
            </div>
            
            <div className="flex gap-3">
              {/* Year Selector */}
              <Select 
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Month Selector */}
              <Select 
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : parseInt(value))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Export Button */}
              <Button variant="outline" onClick={exportToCSV} disabled={expenses.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(totals.totalCost)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Wages</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totals.totalWages)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Allowances</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(totals.totalAllowances)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Days Worked</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {totals.totalDaysWorked}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Expense Table */}
      <Card>
        <CardHeader>
          <CardTitle>Technician-wise Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead className="text-right">Days Worked</TableHead>
                      <TableHead className="text-right">Services</TableHead>
                      <TableHead className="text-right">Total Wages</TableHead>
                      <TableHead className="text-right">Total Allowances</TableHead>
                      <TableHead className="text-right font-bold">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.technicianId}>
                        <TableCell className="font-medium">
                          {expense.technicianName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.employeeCode || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.designation}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{expense.daysWorked}</TableCell>
                        <TableCell className="text-right">{expense.servicesCompleted}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(expense.totalWages)}
                        </TableCell>
                        <TableCell className="text-right text-purple-600">
                          {formatCurrency(expense.totalAllowances)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {formatCurrency(expense.totalCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {expenses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No expense data found for the selected period
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TechnicianExpenseHistory;
