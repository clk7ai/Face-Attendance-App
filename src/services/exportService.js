export const downloadCSV = (data, filename = 'attendance_report.csv') => {
    if (!data || !data.length) return;

    // Extract headers
    const headers = Object.keys(data[0]);

    // Convert data to CSV string
    const csvContent = [
        headers.join(','), // Header row
        ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(',')) // Data rows
    ].join('\n');

    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
